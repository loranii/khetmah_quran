from channels.generic.websocket import AsyncWebsocketConsumer
import json

class KhetmahConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.room_name = self.scope['url_route']['kwargs']['khetmah_id']
        self.room_group_name = f'khetmah_{self.room_name}'

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'send_update',
                'message': data
            }
        )

    async def send_update(self, event):
        await self.send(text_data=json.dumps(event['message']))