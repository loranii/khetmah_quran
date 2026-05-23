
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
    """
    Update khetmah status based on its juzas
    """

    # لا نغير إذا مؤرشفة
    if khetmah.status == "archived":
        return False

    juzas = khetmah.parts.all()

    if juzas.count() == 30 and all(j.status == "read" for j in juzas):
        new_status = "completed"
    else:
        new_status = "active"

    if khetmah.status != new_status:
        khetmah.status = new_status
        khetmah.save()
        return True

    return False