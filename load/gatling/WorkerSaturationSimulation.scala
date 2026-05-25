import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._

class WorkerSaturationSimulation extends Simulation {
  val baseUrl = sys.env.getOrElse("LETBUYY_API_BASE_URL", "https://api.staging.letbuyy.store")

  val httpProtocol = http
    .baseUrl(baseUrl)
    .acceptHeader("application/json")
    .userAgentHeader("letbuyy-worker-saturation")

  val workerHealth = scenario("worker-saturation-health")
    .exec(http("api-health").get("/v1/health").check(status.is(200)))

  setUp(
    workerHealth.inject(rampUsers(500).during(300.seconds))
  ).protocols(httpProtocol)
    .assertions(
      global.failedRequests.percent.lt(1),
      global.responseTime.percentile3.lt(2000),
      global.responseTime.percentile4.lt(4000)
    )
}
