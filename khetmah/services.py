from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


# قسم ادارة الاجزاء والختمات


def update_juza_status(user, khetmah, juz_number, status):
    """
    Handles updating, creating, or removing a Juza
    """
    
    # الحالة: available → إزالة الحجز
    if status == "available":
        juza = khetmah.parts.filter(
            juz_number=juz_number,
            selected_by=user
        ).first()

        if juza:
            juza.selected_by = None
            juza.status = "available"
            juza.save()
            return "released"

        return "no_action"

    # الحالات الأخرى: taken / read
    juza, created = khetmah.parts.update_or_create(
        juz_number=juz_number,
        defaults={
            "selected_by": user,
            "status": status
        }
    )

    return "created" if created else "updated"


# -------------------------------

def handle_creator_last_part(user, khetmah, juz_number, status):
    """
    Prevent creator from releasing their last reserved part
    """

    is_creator = (user == khetmah.creator)

    if not (is_creator and status == "available"):
        return None  # لا يوجد تدخل

    creator_reserved_parts = khetmah.parts.filter(
        selected_by=user
    ).exclude(status="available")

    # إذا هذا آخر جزء
    if creator_reserved_parts.count() == 1 and creator_reserved_parts.filter(juz_number=juz_number).exists():
        juza = creator_reserved_parts.first()
        juza.status = "taken"
        juza.save()

        return {
            "action": "forced_taken",
            "message": "تم تغيير حالة الجزء إلى 'taken' لأنه آخر جزء محجوز لك",
            "status": "taken"
        }

    return None

# -------------------------------


def update_khetmah_status(khetmah):

    juzas = khetmah.parts.all()

    if juzas.count() == 30 and all(
        j.status == "read"
        for j in juzas
    ):
        new_status = "completed"
    else:
        new_status = "active"

    # لا يوجد تغيير
    if khetmah.status == new_status:
        return False

    print(
        f"STATUS CHANGED: "
        f"{khetmah.id} "
        f"{khetmah.status} -> "
        f"{new_status}"
    )

    khetmah.status = new_status
    khetmah.save()

    channel_layer = get_channel_layer()

    # ==================================
    # 1) تحديث صفحة الختمة الحالية
    # ==================================
    async_to_sync(channel_layer.group_send)(
        f"khetmah_{khetmah.id}",
        {
            "type": "send_update",
            "message": {
                "type": "khetmah_status",
                "status": new_status
            }
        }
    )

    print(
        f"KHETMAH ROOM EVENT SENT: "
        f"khetmah_{khetmah.id}"
    )

    # ==================================
    # 2) تحديث القائمة الجانبية
    # ==================================
    async_to_sync(channel_layer.group_send)(
        "khetmah_list",
        {
            "type": "send_update",
            "message": {
                "type": "khetmah_status",
                "khetmah_id": khetmah.id,
                "status": new_status
            }
        }
    )

    print("SIDEBAR EVENT SENT")

    return True