from django.urls import re_path
from . import consumers

websocket_urlpatterns = [

    re_path(
        r'ws/khetmah/(?P<khetmah_id>\d+)/$',
        consumers.KhetmahConsumer.as_asgi()
    ),

    re_path(
        r'ws/khetmah-list/$',
        consumers.KhetmahListConsumer.as_asgi()
    ),

]