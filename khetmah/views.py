from unittest import result
from urllib import request
from django.utils.timezone import localtime
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.db.models import Q
import khetmah
User = get_user_model()
from django.views.decorators.http import require_POST
from django.utils.decorators import method_decorator
from django.core.serializers.json import DjangoJSONEncoder
from .models import Khetmah, Juza
from django.http import HttpResponse, HttpResponseBadRequest, HttpResponseRedirect, Http404, JsonResponse
from django.db import IntegrityError
from django.shortcuts import get_object_or_404, render, redirect
from django.urls import reverse
from .forms import UserForm
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.contrib import messages
import datetime
import json
import os
from .services import (update_juza_status, handle_creator_last_part, update_khetmah_status)
from django.db.models import F, Count, Q
from django.contrib.auth import update_session_auth_hash



def index(request):

    first_khetmah = Khetmah.objects.filter(status='active').order_by('-created_at').first()

    if first_khetmah:
        return redirect('khetmah_detail', khetmah_id=first_khetmah.id)

    return render(request, 'khetmah/index.html')




def user_khetmah_parts_api(request):
    if request.user.is_authenticated:
        active_khetmah = request.user.owned_khetmah.filter(status='active').first()
        userActiveKhetmahId = active_khetmah.id if active_khetmah else None
        unactive_khetmah = request.user.owned_khetmah.filter(status__in=['completed', 'archived']).first()
        userUnactiveKhetmahId = unactive_khetmah.id if unactive_khetmah else None
        # جميع أجزاء المستخدم
        user_parts_queryset = Juza.objects.filter(selected_by=request.user)

        # أجزاء الختمات النشطة فقط
        parts = list(
            user_parts_queryset
            .filter(khetmah__status='active')
            .annotate(
                number=F('juz_number')
            )
            .values(
                'number',
                'status',
                'khetmah_id'
            )
        )

        # الختمات التي قرأ فيها المستخدم أجزاء
        read_khetmahs_data = (user_parts_queryset.filter(status="read").values("khetmah_id").annotate(read_parts_count=Count("id")))
        read_khetmahs = []

        for item in read_khetmahs_data:
            kh = Khetmah.objects.get(id=item["khetmah_id"])

            read_khetmahs.append({
            "id": kh.id,
            "status": kh.status,
            "reason": kh.get_reason_display(),
            "created_at": localtime(kh.created_at).strftime('%Y-%m-%d %H:%M:%S'),
            "creator_id": kh.creator.id,
            "creator__username": kh.creator.username,
            
            "creator__profile_picture":
                kh.creator.profile_picture.url
                if kh.creator.profile_picture
                else "/media/khetmah/images/profile_pictures/default.png",
            "read_parts_count": item["read_parts_count"],
    })
            
        unactive_khetmah_status = (
            unactive_khetmah.status
            if unactive_khetmah
            else None
        )

        unactive_parts = list(
            Juza.objects.filter(
                selected_by=request.user,
                status="read",
                khetmah__status__in=['completed', 'archived']
            )
            .annotate(
                number=F('juz_number')
            )
            .values(
                'number',
                'status',
                'khetmah_id'
            )
        )

        return JsonResponse({
            'userId': request.user.id,
            'isAuthenticated':True,
            'parts': parts,
            'unactive_parts': unactive_parts,
            'userId':request.user.id,
            'currentUsername': f"{request.user.first_name} {request.user.last_name}",
            'user_has_active_khetmah': request.user.has_active_khetmah(),
            'userActiveKhetmahId': userActiveKhetmahId,
            'userUnactiveKhetmahId': userUnactiveKhetmahId,
            'unactive_khetmah_status': unactive_khetmah_status if unactive_khetmah else None,
            'user_has_unfinished_juz': request.user.has_unfinished_juz(),
            'read_khetmahs': list(read_khetmahs),
            
        }, json_dumps_params={'ensure_ascii': False})
    else:
        return JsonResponse({
            'parts': [],
            'user_has_active_khetmah': False,
            'active_khetmah_id': None,
            'user_has_unfinished_juz': False,
        })





@login_required
def create_khetmah(request):
    if request.method == 'GET':
        
        numbers = range(1, 31)
        return render(request, "khetmah/create_khetmah.html", {"numbers": numbers, "user": request.user})

    elif request.method == 'POST':
        try:
            # ✅ بدنا نستخدم request.POST و request.FILES لأننا عم نستقبل بيانات من FormData
            reason = request.POST.get('reason', '')
            sharing_type = request.POST.get('sharing_type', 'family_friends')
            deceased_name = request.POST.get('deceased_name')
            specific_reason = None
            if reason == 'sick':
                 specific_reason = request.POST.get('sick_detail')
            elif reason == 'travel':
                specific_reason = request.POST.get('travel_detail')
            elif reason == 'Thank_God':
                specific_reason = request.POST.get('Thank_God_detail')
            elif reason == 'days':
                specific_reason = request.POST.get('days_detail')
            elif reason == 'need':
                specific_reason = request.POST.get('need_detail')
            elif reason == 'other':
                specific_reason = request.POST.get('specific_reason')
            else:
                specific_reason = request.POST.get('specific_reason')  # fallback                         
            death_date = request.POST.get('death_date') or None
            if death_date == None:
               death_date =  datetime.datetime.now() 
            na3wa_image = request.FILES.get('na3wa_picture')  # ✅ صورة النعوة

            # ✅ التحقق من وجود ختمة نشطة
            existing_khetmah = Khetmah.objects.filter(creator=request.user, status='active').first()
            if existing_khetmah:
                return JsonResponse({'success': False,'message': 'لديك ختمة نشطة بالفعل، عليك إنهاء الختمة أو إغلاقها قبل إنشاء ختمة جديدة','redirect_id': existing_khetmah.id}, status=400)   
            # ✅ إنشاء الختمة
            khetmah = Khetmah.objects.create(
                creator = request.user,
                reason = reason,
                sharing_type = sharing_type,
                deceased_name = deceased_name,
                specific_reason = specific_reason,
                death_date = death_date,
                na3wa_image = na3wa_image  # ⬅️ حفظ صورة النعوة إذا وُجدت
            )

            # ✅ جلب الأجزاء (JSON) وتحويلها
            parts_json = request.POST.get('parts')
            if parts_json:
                parts = json.loads(parts_json)
                for part in parts:
                    Juza.objects.create(
                        khetmah=khetmah,
                        juz_number=part['number'],
                        status=part['status'],
                        selected_by=request.user
                    )

            return JsonResponse({'success': True, 'khetmah_id': khetmah.id})

        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=500)

    else:
        return JsonResponse({'success': False, 'message': 'طريقة غير مسموحة'}, status=405)






def khetmah_detail(request, khetmah_id):
    try:
        khetmah = Khetmah.objects.get(id=khetmah_id)
        khetmah_creator = khetmah.creator
    except Khetmah.DoesNotExist:
        raise Http404("Khetmah does not exist")
    all_khetmahs = []
    for k in Khetmah.objects.all().order_by('-created_at'):
        all_khetmahs.append({
        "id": k.id,
        "status": k.status,
        "reason": k.get_reason_display(),  # أو get_reason_display()
        "created_at": localtime(k.created_at).strftime("%Y-%m-%d %H:%M"),
        "creator__username": k.creator.username,
        'creator_id': k.creator.id,
        "creator__profile_picture": k.creator.profile_picture_url,
    })
    if request.method == "POST":
     if request.user == khetmah.creator:
        if request.FILES.get('na3wa_image'):
            khetmah.na3wa_image = request.FILES['na3wa_image']
            khetmah.save()

    is_I_creator = request.user.is_authenticated and (request.user == khetmah.creator)

    juzas = Juza.objects.filter(khetmah=khetmah)
    juzas_dict = {juza.juz_number: juza for juza in juzas}

    # تأكد أن المستخدم مسجل قبل استدعاء أي علاقة على user.id أو user
    if request.user.is_authenticated:
        is_I_taken_any_juza = juzas.filter(selected_by=request.user).exists()
        current_username = f"{request.user.first_name} {request.user.last_name}"
    else:
        is_I_taken_any_juza = False
        current_username = ""

    is_I_joined_khetmah = is_I_taken_any_juza

    parts_data = []

    for i in range(1, 31):
        juza = juzas_dict.get(i)
        if juza:
            selected_jezaa_by_I = request.user.is_authenticated and (juza.selected_by == request.user)
            parts_data.append({
                "number": i,
                "status": juza.status,
                "is_I_creator": is_I_creator,
                "is_I_joined_khetmah": is_I_joined_khetmah,
                "selected_jezaa_by_I": selected_jezaa_by_I,
                "selected_by": f"{juza.selected_by.first_name} {juza.selected_by.last_name}" if juza.selected_by else "",
                "selected_by_id": juza.selected_by.id if juza.selected_by else None,
                "current_username": current_username,
            })
        else:
            parts_data.append({
                "number": i,
                "status": "available",
                "is_I_creator": is_I_creator,
                "is_I_joined_khetmah": is_I_joined_khetmah,
                "selected_jezaa_by_I": False,
                "selected_by": "",
                "selected_by_id": None,
                "current_username": current_username,
            })

    return render(request, "khetmah/khetmah_detail.html", {
        "khetmah": khetmah,
        "khetmah_creator": khetmah_creator,
        "all_khetmahs_json": json.dumps(all_khetmahs),
        "user": request.user,
        "current_username": current_username,
        "is_I_creator": is_I_creator,
        "is_I_joined_khetmah": is_I_joined_khetmah,
        "selected_jezaa_by_I": is_I_taken_any_juza,
        "all_parts_json": json.dumps(parts_data, ensure_ascii=False),
        "parts": parts_data,
        "current_khetmah": khetmah,
    })




def na3wa_upload_path(instance, filename):
    user = f"{instance.creator.first_name}_{instance.creator.last_name}"  # صاحب الختمة
    base, ext = os.path.splitext(filename)
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")

    new_filename = f"{user}_{base}_{timestamp}{ext}"
    
    return f"khetmah/images/na3wa_pictures/{new_filename}"


@login_required
def archives(request):
    if request.method in ["PUT", "PATCH"]:
        try:
            print("Body:",request.body)  # فحص البيانات القادمة
            data = json.loads(request.body)
            khetmah_id = data.get("khetmah_id")
            khetmah = Khetmah.objects.get(id=khetmah_id, creator=request.user)
            khetmah.status = "archived"
            khetmah.save()

            return JsonResponse({
                "success": True,
                "message": "تم أرشفة الختمة",
                "status": "archived",
                "khetmah_id":khetmah_id,
                'user_has_unfinished_juz': False,  # بعد الأرشفة، لا يوجد أجزاء غير مكتملة  
            })
        except Khetmah.DoesNotExist:
            return JsonResponse({"error": "الختمة غير موجودة أو لا تملك صلاحية تعديلها"}, status=404)
        except Exception as e:
            print("Body:",request.body)  # فحص البيانات القادمة
            print(f"⚠️ خطأ: {str(e)}")
            return JsonResponse({"error": str(e)}, status=500)





@login_required
def active_khetmah(request):
    if request.method in ["PUT", "PATCH"]:
        try:
            print("Body:",request.body)  # فحص البيانات القادمة
            data = json.loads(request.body)
            khetmah_id = data.get("khetmah_id")
            khetmah = Khetmah.objects.get(id=khetmah_id, creator=request.user)
            juzas = Juza.objects.filter(khetmah=khetmah)
            total_juzas = juzas.count()
            # إذا كان عدد الأجزاء 30 وكلها بحالة read
            all_read = (total_juzas == 30 and all(juza.status == "read" for juza in juzas))
            if all_read:
                khetmah.status = "completed"
                khetmah.save()
            else:
                khetmah.status = "active"
                khetmah.save()

            return JsonResponse({
                "success": True,
                "message": "تم تنشيط الختمة",
                "status": khetmah.status,
                "khetmah_id" : khetmah_id,
            })
        except Khetmah.DoesNotExist:
            return JsonResponse({"error": "الختمة غير موجودة أو لا تملك صلاحية تعديلها"}, status=404)
        except Exception as e:
            print("Body:",request.body)  # فحص البيانات القادمة
            print(f"⚠️ خطأ: {str(e)}")
            return JsonResponse({"error": str(e)}, status=500)





@login_required
def delete_khetmah(request):
    if request.method == "DELETE":
        try:
            data = json.loads(request.body)
            khetmah_id = data.get("khetmah_id")
            user = request.user
            khetmah = Khetmah.objects.get(id=khetmah_id)
            status = khetmah.status

            if user == khetmah.creator:
                khetmah.delete()
                khetmah_updated = True

                # نجيب آخر ختمة موجودة
                lastkhetmah = Khetmah.objects.order_by('-created_at').first()
                lastkhetmahID = lastkhetmah.id if lastkhetmah else None

                return JsonResponse({
                    "success": True,
                    "action": "khetmah_archived",
                    "message": "تم حذف الختمة بنجاح",
                    "status": status,
                    "khetmah_updated": khetmah_updated,
                    "lastkhetmahID": lastkhetmahID,
                })

            else:
                return JsonResponse({
                    "success": False,
                    "action": "not_response",
                    "message": "لايمكنك حذف ختمة ليست لك",
                    "status": status,
                    "khetmah_updated": False,
                })

        except Khetmah.DoesNotExist:
            return JsonResponse({"error": "الختمة غير موجودة"}, status=404)
        except Exception as e:
            print(f"⚠️ خطأ: {str(e)}")
            return JsonResponse({"error": str(e)}, status=500)

    else:
        return JsonResponse({"error": "طلب غير مسموح"}, status=405)



# ------------------------------




@login_required
def get_archives(request):

    all_unactive_khetmahs = Khetmah.objects.filter(
        status__in=['archived', 'completed']
    ).filter(
        Q(creator=request.user) |
        Q(parts__selected_by=request.user)
    ).distinct().order_by('-created_at')

    user_parts_data = list(
        Juza.objects.filter(
            selected_by=request.user
        ).values('juz_number', 'status')
    )

    user_All_parts_json = json.dumps(
        user_parts_data,
        ensure_ascii=False
    )

    return render(request, 'khetmah/archives.html', {
        'all_unactive_khetmahs': all_unactive_khetmahs,
        'user_All_parts_json': user_All_parts_json,
    })

# /------------------------------

@login_required
def update_part(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            khetmah_id = data.get("khetmah_id")
            jezaaNumber = data.get("part_number")
            status = data.get("status")

            if not all([khetmah_id, jezaaNumber, status]):
                return JsonResponse({"error": "بيانات ناقصة"}, status=400)

            user = request.user
            khetmah = Khetmah.objects.get(id=khetmah_id)
            previous_khetmah_status = khetmah.status

            # تحقق إذا كان المستخدم هو نفسه منشئ الختمة
            is_creator = (user == khetmah.creator)
            
            result = handle_creator_last_part(user, khetmah, jezaaNumber, status)

            if result:
                return JsonResponse({
                    "success": True,
                    **result
                })
                
            action = update_juza_status(user, khetmah, jezaaNumber, status)

            # التحقق من حالة جميع الأجزاء بعد التحديث
            khetmah_updated = update_khetmah_status(khetmah)

            return JsonResponse({
                "success": True, 
                "action": action,
                "khetmah_updated": khetmah_updated,
                "new_khetmah_status": khetmah.status,
                "is_creator" : is_creator,
            })

        except Khetmah.DoesNotExist:
            return JsonResponse({"error": "الختمة غير موجودة"}, status=404)
        except Exception as e:
            print(f"⚠️ خطأ: {str(e)}")
            return JsonResponse({"error": str(e)}, status=500)





@login_required

def profile(request):
    user = request.user

    if request.method == "POST":
        first_name = request.POST.get("first_name", "").strip().capitalize()
        last_name = request.POST.get("last_name", "").strip().capitalize()
        email = request.POST.get("email", "").strip()
        password = request.POST.get("password", "")
        profile_picture = request.FILES.get("profile_picture")

        # تحديث الحقول القابلة للتعديل
        user.first_name = first_name
        user.last_name = last_name
        user.email = email

        # تحديث كلمة المرور إن وُجدت
        if password:
            user.set_password(password)

        # تحديث الصورة الشخصية
        if profile_picture:
            old_pic = user.profile_picture

            if old_pic and old_pic.name != "khetmah/images/profile_pictures/default.png":
                try:
                    if os.path.isfile(old_pic.path):
                        os.remove(old_pic.path)
                except Exception as e:
                    print("خطأ أثناء حذف الصورة القديمة:", e)

            user.profile_picture = profile_picture

        user.save()
        # AJAX REQUEST
            # حتى لا يتم تسجيل الخروج بعد تغيير كلمة المرور
        if password:
            update_session_auth_hash(request, user)

        if request.headers.get("x-requested-with") == "XMLHttpRequest":
            return JsonResponse({
                "success": True,
                "username": user.username,
                "full_name": f"{user.first_name} {user.last_name}",
                "profile_picture": user.profile_picture_url,
            })
        messages.success(request,"تم تحديث بياناتك بنجاح")

        return redirect("profile")
        # GET AJAX
    # GET REQUEST
    return render(request, "khetmah/profile.html", {
    "user": user, })




def login_view(request):

    next_url = request.GET.get('next')

    if request.method == "POST":

        username = request.POST["username"]
        password = request.POST["password"]

        next_url = request.POST.get("next")

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)

            if next_url:
                return redirect(next_url)

            return redirect("index")

        else:
            return render(request, "khetmah/login.html", {
                "message": "Invalid username and/or password.",
                "next": next_url
            })

    return render(request, "khetmah/login.html", {
        "next": next_url
    })







def register(request):

    next_url = request.GET.get('next')

    if request.method == "POST":

        next_url = request.POST.get("next")

        username = request.POST["username"]
        firstName = request.POST.get("First_Name", "").capitalize()
        lastName = request.POST.get("Last_Name", "").capitalize()

        email = request.POST["email"]

        password = request.POST["password"]
        confirmation = request.POST["confirmation"]

        if password != confirmation:
            return render(request, "khetmah/register.html", {
                "message": "Passwords must match.",
                "next": next_url
            })

        try:

            form = UserForm(request.POST, request.FILES)

            if form.is_valid():

                profile_picture = form.cleaned_data.get('profile_picture')

                user = User.objects.create_user(
                    username=username,
                    first_name=firstName,
                    last_name=lastName,
                    email=email,
                    password=password,
                    profile_picture=profile_picture
                )

                login(request, user)

                if next_url:
                    return redirect(next_url)

                return redirect("index")

            else:

                return render(request, 'khetmah/register.html', {
                    'form': form,
                    'message': form.errors,
                    'next': next_url
                })

        except IntegrityError:

            return render(request, "khetmah/register.html", {
                "message": f'Username <span class="username-error">{username}</span> already taken.',
                "next": next_url
            })

    else:

        form = UserForm()

        return render(request, "khetmah/register.html", {
            'form': form,
            'next': next_url
        })

# ////////////////////////////////////


def logout_view(request):

    next_url = request.META.get("HTTP_REFERER", "")

    logout(request)

    # إذا كان داخل صفحة ختمة
    if "/khetmah_detail/" in next_url:
        return redirect(next_url)

    # غير ذلك ارجع للرئيسية
    return redirect("index")