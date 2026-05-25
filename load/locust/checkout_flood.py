import os

from locust import HttpUser, between, task


class CheckoutFloodUser(HttpUser):
    host = os.getenv("LETBUYY_API_BASE_URL", "https://api.staging.letbuyy.store")
    wait_time = between(0.05, 0.25)

    @task(3)
    def health_probe(self):
        self.client.get("/v1/health", name="health")

    @task(1)
    def storefront_probe(self):
        self.client.get("/v1/storefront/health", name="storefront-health")
