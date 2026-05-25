resource "cloudflare_kv_namespace" "runtime_cache" {
  account_id = var.cloudflare_account_id
  title      = "letbuyy-runtime-cache"
}

resource "cloudflare_kv_namespace" "runtime_cache_staging" {
  account_id = var.cloudflare_account_id
  title      = "letbuyy-runtime-cache-staging"
}

resource "cloudflare_r2_bucket" "runtime_storage" {
  account_id = var.cloudflare_account_id
  name       = "letbuyy-production-storage"
  location   = "APAC"
}

resource "cloudflare_r2_bucket" "runtime_storage_staging" {
  account_id = var.cloudflare_account_id
  name       = "letbuyy-staging-storage"
  location   = "APAC"
}

output "letbuyy_runtime_cache_namespace_ids" {
  sensitive = true
  value = {
    production = cloudflare_kv_namespace.runtime_cache.id
    staging    = cloudflare_kv_namespace.runtime_cache_staging.id
  }
}

output "letbuyy_runtime_storage_bucket_names" {
  value = {
    production = cloudflare_r2_bucket.runtime_storage.name
    staging    = cloudflare_r2_bucket.runtime_storage_staging.name
  }
}
