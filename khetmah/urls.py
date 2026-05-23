# app urls
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from . import views
from django.views.generic import TemplateView

urlpatterns = [
    path("", views.index, name="index"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("register/", views.register, name="register"),

    # user
    path("profile", views.profile, name="profile"),

    # khetmah
    path("create_khetmah/", views.create_khetmah, name="create_khetmah"),
    path("khetmah_detail/<int:khetmah_id>/", views.khetmah_detail, name="khetmah_detail"),

    # api
    path('user_khetmah_parts_api/', views.user_khetmah_parts_api, name='user_khetmah_parts_api'),
    path("update_part/", views.update_part, name="update_part"),

    # status
    path("archives/", views.archives, name="archives"),
    path("get_archives/", views.get_archives, name="get_archives"),
    path("active_khetmah/", views.active_khetmah, name="active_khetmah"),
    path("delete_khetmah/", views.delete_khetmah, name="delete_khetmah"),

]
