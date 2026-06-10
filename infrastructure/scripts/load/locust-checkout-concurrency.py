import os

from locust import HttpUser, between, task


class CheckoutConcurrencyUser(HttpUser):
    wait_time = between(0.2, 1.0)
    host = os.getenv("LETBUYY_API_BASE_URL", "https://api.staging.letbuyy.com")

    @task
    def checkout_health_probe(self):
        self.client.get("/v1/health", name="api-health")
