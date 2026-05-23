from django import forms


class UserForm(forms.Form):

 profile_picture = forms.ImageField(required=False,widget=forms.FileInput(attrs={'class': 'form-control'}))