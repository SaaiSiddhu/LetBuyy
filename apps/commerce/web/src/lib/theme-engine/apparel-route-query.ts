import { discoveryRouteQuery, scalarDiscoveryQuery } from './discovery-route-query';

/** Legacy scalar export. Listing routes also carry discoveryQuery for repeated facets. */
export function apparelRouteQuery(query: Record<string, unknown> | undefined): Record<string, string> {
    return scalarDiscoveryQuery(discoveryRouteQuery(query));
}
