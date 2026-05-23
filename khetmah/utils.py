import os
from datetime import datetime


def na3wa_upload_path(instance, filename):
    user = f"{instance.creator.first_name}_{instance.creator.last_name}".replace(" ", "_")
    
    base, ext = os.path.splitext(filename)
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")

    return f"khetmah/images/na3wa_pictures/{user}_{base}_{timestamp}{ext}"

