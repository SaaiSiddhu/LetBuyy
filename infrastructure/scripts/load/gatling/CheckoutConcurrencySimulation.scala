import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._

class CheckoutConcurrencySimulation extends Simulation {
  val baseUrl = sys.env.getOrElse("LETBUYY_API_BASE_URL", "https://api.staging.letbuyy.com")

  val httpProtocol = http
    .baseUrl(baseUrl)
    .acceptHeader("application/json")
    .userAgentHeader("letbuyy-gatling-certification")

  val scenarioDefinition = scenario("checkout-concurrency-health")
    .exec(http("api-health").get("/v1/health").check(status.is(200)))

  setUp(
    scenarioDefinition.inject(rampUsers(100).during(60.seconds))
  ).protocols(httpProtocol)
}
