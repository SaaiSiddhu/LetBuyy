import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require=createRequire(new URL('../../../../../../../apps/commerce/web/package.json', import.meta.url));
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const lucide=require('lucide-react');
const icons={};
for(const name of ['Search','UserRound','ShoppingBag','ArrowRight','ArrowLeft','ChevronDown','ChevronRight','Check','MapPin','Package','SlidersHorizontal','Minus','Plus','X','LockKeyhole','Mail','LogOut','Heart','Settings','Truck','Eye','CheckCircle2','CircleHelp','Menu','Ruler','RefreshCw','CreditCard','Info']) {
 icons[name]=renderToStaticMarkup(React.createElement(lucide[name],{size:20,strokeWidth:1.4,'aria-hidden':true}));
}
writeFileSync(new URL('./icons.json',import.meta.url),JSON.stringify(icons));
