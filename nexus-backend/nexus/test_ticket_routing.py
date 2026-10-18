import asyncio
import unittest
from uuid import uuid4

from services.ticket_api import TicketReassignment, TicketWebhook, ingest_ticket, reassign_ticket, tickets
from services.ticket_pipeline import TicketPipeline


class TicketRoutingTests(unittest.TestCase):
    def setUp(self):
        tickets.clear()

    def test_pipeline_scrubs_and_routes(self):
        result = TicketPipeline().process({
            "channel": "email",
            "subject": "Unauthorized payment",
            "content": "Call +1 555 123 4567 or write to customer@example.com. This is urgent.",
        })

        self.assertNotIn("customer@example.com", result["content"])
        self.assertNotIn("+1 555 123 4567", result["content"])
        self.assertEqual(result["intent"], "fraud")
        self.assertEqual(result["sentiment"], "urgent")
        self.assertEqual(result["specialist_queue"], "fraud-specialists")
        self.assertLessEqual(len(result["explanation"]), 5)

    def test_duplicate_webhook_is_idempotent(self):
        payload = TicketWebhook(
            id="ticket-1",
            channel="chat",
            subject="Login error",
            content="The app is broken and I cannot login.",
        )

        first = asyncio.run(ingest_ticket(payload))
        second = asyncio.run(ingest_ticket(payload))

        self.assertEqual(first["status"], "accepted")
        self.assertEqual(second["status"], "duplicate")
        self.assertEqual(len(tickets), 1)

    def test_reassignment_records_feedback(self):
        ticket_id = f"ticket-2-{uuid4()}"
        payload = TicketWebhook(id=ticket_id, content="I cannot access my account")
        asyncio.run(ingest_ticket(payload))

        response = asyncio.run(reassign_ticket(
            ticket_id,
            TicketReassignment(specialist_queue="billing-specialists", reason="Agent correction"),
        ))

        self.assertEqual(response["ticket"]["specialist_queue"], "billing-specialists")
        self.assertTrue(response["ticket"]["was_reassigned"])
        self.assertEqual(response["ticket"]["final_resolved_queue"], "billing-specialists")


if __name__ == "__main__":
    unittest.main()
