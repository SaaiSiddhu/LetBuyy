resource "cloudflare_kv_namespace" "runtime_cache" {
  account_id = var.cloudflare_account_id
  title      = "letbuyy-cache-production"
}

resource "cloudflare_kv_namespace" "runtime_cache_staging" {
  account_id = var.cloudflare_account_id
  title      = "letbuyy-cache-staging"
}

resource "cloudflare_kv_namespace" "runtime_cache_dev" {
  account_id = var.cloudflare_account_id
  title      = "letbuyy-dev-kv"
}

resource "cloudflare_r2_bucket" "runtime_storage" {
  account_id = var.cloudflare_account_id
  name       = "letbuyy-media-production"
  location   = "APAC"
}

resource "cloudflare_r2_bucket" "runtime_storage_staging" {
  account_id = var.cloudflare_account_id
  name       = "letbuyy-media-staging"
  location   = "APAC"
}

resource "cloudflare_r2_bucket" "runtime_storage_dev" {
  account_id = var.cloudflare_account_id
  name       = "letbuyy-dev-r2"
  location   = "APAC"
}

resource "cloudflare_d1_database" "runtime_d1" {
  account_id = var.cloudflare_account_id
  name       = "letbuyy-production-d1"
}

resource "cloudflare_d1_database" "runtime_d1_staging" {
  account_id = var.cloudflare_account_id
  name       = "letbuyy-staging-d1"
}

resource "cloudflare_d1_database" "runtime_d1_dev" {
  account_id = var.cloudflare_account_id
  name       = "letbuyy-dev-d1"
}

output "letbuyy_runtime_cache_namespace_ids" {
  sensitive = true
  value = {
    dev        = cloudflare_kv_namespace.runtime_cache_dev.id
    production = cloudflare_kv_namespace.runtime_cache.id
    staging    = cloudflare_kv_namespace.runtime_cache_staging.id
  }
}

output "letbuyy_runtime_storage_bucket_names" {
  value = {
    dev        = cloudflare_r2_bucket.runtime_storage_dev.name
    production = cloudflare_r2_bucket.runtime_storage.name
    staging    = cloudflare_r2_bucket.runtime_storage_staging.name
  }
}

output "letbuyy_runtime_d1_database_ids" {
  sensitive = true
  value = {
    dev        = cloudflare_d1_database.runtime_d1_dev.id
    production = cloudflare_d1_database.runtime_d1.id
    staging    = cloudflare_d1_database.runtime_d1_staging.id
  }
}
