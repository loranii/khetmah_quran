from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from django.conf import settings
from django.utils.text import slugify
import os
from django.core.exceptions import ValidationError
from django.db.models.signals import pre_save, post_delete
from django.dispatch import receiver



class User(AbstractUser):
    profile_picture = models.ImageField(
        upload_to='khetmah/images/profile_pictures/', 
        blank=True, 
        null=True,
        default="khetmah/images/profile_pictures/default.png"
    )
    def __str__(self):
        return f" {self.first_name} {self.last_name}"

    @property
    
    def profile_picture_url(self):

        if self.profile_picture:
            return self.profile_picture.url
        return "/media/khetmah/images/profile_pictures/default.png"

    def pic_filename(self):
        return os.path.basename(self.profile_picture.name)

    def has_active_khetmah(self):
        return self.owned_khetmah.filter(status='active').exists()

    def has_unfinished_juz(self):
        return self.user_selected_juza.filter(status__in=['taken']).exists()

    def user_khetmah_id(self):
        active_khetmah = self.owned_khetmah.filter(status='active').first()
        return active_khetmah.id if active_khetmah else None


# مسار الصورة الافتراضية
DEFAULT_NA3WA = 'khetmah/images/na3wa_pictures/not-available.png'

def na3wa_upload_path(instance, filename):
    if instance.creator:
        full_name = f"{instance.creator.first_name}_{instance.creator.last_name}".replace(" ", "_")
    else:
        full_name = "unknown_user"
    
    deceased = instance.deceased_name or "no_name"
    deceased = slugify(deceased, allow_unicode=True)
    full_name = slugify(full_name, allow_unicode=True)

    base, ext = os.path.splitext(filename)
    timestamp = timezone.now().strftime("%Y%m%d%H%M%S")

    return f"khetmah/images/na3wa_pictures/({full_name})-na3wa-{deceased}_{base}_{timestamp}{ext}"



class Khetmah(models.Model):
    PRIVACY_CHOICES = [('family_friends', 'مع الأهل والأصدقاء'),('public', 'عامة للجميع'),] 
    KHETMAH_STATUS = [('active', 'نشطة'),('completed', 'مكتملة')]
    REASON_CHOICES = [('dead', 'هبة لمتوفي'),('need', 'لطلب حاجة'),('sick', 'لطلب شفاء'),('travel', 'السفر'),('Thank_God', 'شكر لله'),('days', 'أيام فضيلة'),('other', 'سبب آخر'),]
    status = models.CharField(max_length=20, choices=KHETMAH_STATUS, default='active')
    reason = models.CharField(max_length=20, choices=REASON_CHOICES, blank=True, null=True, default='Thank_God')
    sharing_type = models.CharField(max_length=20, choices=PRIVACY_CHOICES, blank=True, null=True, default='family_friends') 
    creator = models.ForeignKey('User', on_delete=models.CASCADE, related_name="owned_khetmah")
    na3wa_image = models.ImageField(upload_to=na3wa_upload_path,blank=True,null=True,default=DEFAULT_NA3WA)
    created_at = models.DateTimeField(auto_now_add=True)
    # حقول إضافية بناءً على السبب
    deceased_name = models.CharField(max_length=32, blank=True, null=True)
    death_date = models.DateField(blank=True, null=True)
    specific_reason = models.TextField(blank=True, null=True)
   

    def __str__(self):
        return f"khetmah : {self.creator.get_full_name()} / {self.reason} /id :  {self.id} / {self.status}"
    
    @property
    def is_active(self):
      return self.status == 'active'



class Juza(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = 'available', 'متاح'
        TAKEN = 'taken', 'محجوز'
        READ = 'read', 'مقروء'

    khetmah = models.ForeignKey(Khetmah, on_delete=models.CASCADE, related_name="parts")
    juz_number = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.AVAILABLE)
    selected_by = models.ForeignKey('User', on_delete=models.CASCADE, related_name="user_selected_juza", null=True, blank=True)

    taken_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('khetmah', 'juz_number')

    def __str__(self):
        return f"Juza {self.juz_number} - {self.status} -Khetmah {self.khetmah_id}"

    def clean(self):
        if self.status == 'available' and self.selected_by:
            raise ValidationError("Available juz cannot have a user")






@receiver(pre_save, sender=Khetmah)
def delete_old_na3wa(sender, instance, **kwargs):
    if not instance.pk:
        return

    try:
        old = Khetmah.objects.get(pk=instance.pk)
    except Khetmah.DoesNotExist:
        return

    # إذا تغيرت الصورة
    if old.na3wa_image and old.na3wa_image != instance.na3wa_image:
        # لا تحذف الصورة الافتراضية
        if old.na3wa_image.name != DEFAULT_NA3WA:
            old.na3wa_image.delete(save=False)


@receiver(post_delete, sender=Khetmah)
def delete_na3wa_on_delete(sender, instance, **kwargs):
    if instance.na3wa_image:
        if instance.na3wa_image.name != DEFAULT_NA3WA:
            instance.na3wa_image.delete(save=False)