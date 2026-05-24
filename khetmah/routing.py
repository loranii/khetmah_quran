from django.urls import re_path

from .consumer import KhetmahConsumer

websocket_urlpatterns = [

    re_path(
        r'ws/khetmah/(?P<khetmah_id>\d+)/$',
        KhetmahConsumer.as_asgi()
    ),
]