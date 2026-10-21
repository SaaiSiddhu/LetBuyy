import type { StorefrontRouteContext } from './types';
import { productOriginFilterMarkup } from './platform-control-markup';

export function StorefrontProductOriginFilter({ route, editorMode = false }: { route: StorefrontRouteContext; editorMode?: boolean }) {
    const html = productOriginFilterMarkup(route, editorMode);
    return html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : null;
}
