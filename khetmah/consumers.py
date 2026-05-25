from channels.generic.websocket import AsyncWebsocketConsumer
import json


class KhetmahConsumer(AsyncWebsocketConsumer):

    async def connect(self):

        self.khetmah_id = self.scope['url_route']['kwargs']['khetmah_id']

        self.room_group_name = f'khetmah_{self.khetmah_id}'

        user = self.scope.get("user")

        # منع anonymous إذا أردت
        # إذا تريد السماح بالمشاهدة احذف هذا الشرط
        # if user.is_anonymous:
        #     await self.close()
        #     return

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

        try:

            data = json.loads(text_data)

            message_type = data.get("type")

            # =========================
            # PART UPDATE
            # =========================

            if message_type == "part_update":

                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "broadcast_message",
                        "message": {
                            "type": "part_update",
                            "part_number": data.get("part_number"),
                            "status": data.get("status"),
                            "username": data.get("username"),
                        }
                    }
                )

            # =========================
            # KHETMAH STATUS
            # =========================

            elif message_type == "khetmah_status":

                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "broadcast_message",
                        "message": {
                            "type": "khetmah_status",
                            "status": data.get("status"),
                            "khetmah_id": data.get("khetmah_id"),
                        }
                    }
                )

            # =========================
            # KHETMAH DELETE
            # =========================

            elif message_type == "khetmah_deleted":

                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "broadcast_message",
                        "message": {
                            "type": "khetmah_deleted",
                            "khetmah_id": data.get("khetmah_id"),
                        }
                    }
                )

        except Exception as e:

            await self.send(text_data=json.dumps({
                "type": "error",
                "message": str(e)
            }))

    async def broadcast_message(self, event):

        await self.send(
            text_data=json.dumps(event["message"])
        )