import json

from channels.generic.websocket import AsyncWebsocketConsumer


class KhetmahConsumer(AsyncWebsocketConsumer):

    async def connect(self):

        self.khetmah_id = self.scope["url_route"]["kwargs"]["khetmah_id"]

        self.room_group_name = f"khetmah_{self.khetmah_id}"

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
                "type": "khetmah_update",
                "data": data
            }
        )

    async def khetmah_update(self, event):

        await self.send(
            text_data=json.dumps(event["data"])
        )