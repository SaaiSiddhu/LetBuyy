import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire('/Volumes/Projects/LetBuyy/apps/commerce/web/package.json');
const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');const lucide=require('lucide-react');
const names=['Menu','Search','UserRound','ShoppingBag','ArrowRight','ArrowUpRight','ChevronRight','ChevronLeft','Check','X','SlidersHorizontal','Package','CircleHelp','CircleAlert','LockKeyhole','CreditCard','MapPin','LogOut','CheckCircle2','Truck','Plus'];
fs.writeFileSync(new URL('icons.json',import.meta.url),JSON.stringify(Object.fromEntries(names.map(n=>[n,renderToStaticMarkup(React.createElement(lucide[n],{size:20,strokeWidth:1.5,'aria-hidden':true}))]))));
