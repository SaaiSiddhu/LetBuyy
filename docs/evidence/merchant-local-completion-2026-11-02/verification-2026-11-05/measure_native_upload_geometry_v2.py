# Read-only analysis of retained native evidence; no image or application edit.
from pathlib import Path
from collections import Counter
import struct,zlib,json,re,sys,hashlib,ast
png,tree,log,out=map(Path,sys.argv[1:]);raw=png.read_bytes();assert raw[:8]==b"\x89PNG\r\n\x1a\n";at=8;compressed=bytearray()
while at<len(raw):
 length=struct.unpack('>I',raw[at:at+4])[0];kind=raw[at+4:at+8];payload=raw[at+8:at+8+length];crc=struct.unpack('>I',raw[at+8+length:at+12+length])[0];assert zlib.crc32(kind+payload)&0xffffffff==crc
 if kind==b'IHDR':width,height,bits,color,compression,filtering,interlace=struct.unpack('>IIBBBBB',payload)
 if kind==b'IDAT':compressed.extend(payload)
 at+=12+length
assert bits==8 and color==2 and compression==0 and filtering==0 and interlace==0
stride=width*3;data=zlib.decompress(compressed);assert len(data)==height*(stride+1);pixels=bytearray(width*height*3);previous=bytearray(stride)
for y in range(height):
 start=y*(stride+1);mode=data[start];line=bytearray(data[start+1:start+1+stride])
 if mode:
  for x in range(stride):
   left=line[x-3]if x>=3 else 0;up=previous[x];corner=previous[x-3]if x>=3 else 0
   if mode==1:prediction=left
   elif mode==2:prediction=up
   elif mode==3:prediction=(left+up)//2
   elif mode==4:
    q=left+up-corner;a=abs(q-left);b=abs(q-up);c=abs(q-corner);prediction=left if a<=b and a<=c else up if b<=c else corner
   else:raise AssertionError('Unknown PNG filter')
   line[x]=(line[x]+prediction)&255
 pixels[y*stride:(y+1)*stride]=line;previous=line
text=tree.read_text();window=re.search(r'Window \(Main\).*?\{\{0.0, 0.0\}, \{([0-9.]+), ([0-9.]+)\}\}',text);assert window
scale=width/float(window[1]);assert abs(scale-height/float(window[2]))<1e-9
match=re.search(r'LETBUYY_SETTLED_RESUMED_UPLOAD_ACCESSIBLE_FRAME (.+)',log.read_text());assert match;ax=list(ast.literal_eval(match[1]));assert len(ax)==4
x0=max(0,int((ax[0]-4)*scale));x1=min(width,int((ax[0]+ax[2]+4)*scale));y0=max(0,int((ax[1]-64)*scale));y1=min(height,int((ax[1]+ax[3]+64)*scale))
counts=Counter()
for y in range(y0,y1):
 for x in range(x0,x1):
  pos=y*stride+x*3;r,g,b=pixels[pos:pos+3]
  if 130<r<240 and 100<g<230 and b>=220 and b>r+10 and b>g+15:counts[(r,g,b)]+=1
fill,count=counts.most_common(1)[0];assert count>15000,'Need a dominant filled action, not text or a guessed box'
xs=[];ys=[]
for y in range(y0,y1):
 for x in range(x0,x1):
  pos=y*stride+x*3
  if tuple(pixels[pos:pos+3])==fill:xs.append(x);ys.append(y)
box=[min(xs)/scale,min(ys)/scale,(max(xs)+1)/scale,(max(ys)+1)/scale];paint=[(box[0]+box[2])/2,(box[1]+box[3])/2];center=[ax[0]+ax[2]/2,ax[1]+ax[3]/2];delta=[paint[i]-center[i]for i in range(2)];dimensions=[box[2]-box[0],box[3]-box[1]];padding=[box[0]-ax[0],box[1]-ax[1],ax[0]+ax[2]-box[2],ax[1]+ax[3]-box[3]];passed=max(map(abs,delta))<=1 and min(padding)>=-1 and max(padding)<=4.5 and abs(padding[0]-padding[2])<=1 and abs(padding[1]-padding[3])<=1 and dimensions[0]>=ax[2]*0.9 and dimensions[1]>=ax[3]*0.8
result={'passed':passed,'method':'Exact dominant purple fill bounding box in a narrow horizontal region around the observed AX upload button; broad vertical region detects an offset up to64points. Native screenshot was captured after1.2seconds of settling; no image edit and no coordinate input.','screenshot':str(png),'screenshot_sha256':hashlib.sha256(raw).hexdigest(),'hierarchy':str(tree),'hierarchy_sha256':hashlib.sha256(tree.read_bytes()).hexdigest(),'pixels':[width,height],'point_scale':scale,'fill_rgb':fill,'fill_pixels':count,'painted_box_points':box,'AX_frame_points':ax,'painted_center_points':paint,'AX_center_points':center,'center_delta_points':delta,'tolerance_points':1,'visual_inset_within_accessibility_target_points':padding,'criterion':'Center alignment within1point and symmetric visible fill enclosed by AX touch target; allow up to4.5point inset. Do not require painted fill height40 to equal its padded touch target48. The earlier equal-size-assumption failure is retained.','scope':'This recovered full-page KYC Upload action on the exact task-owned simulator; not generic modal, all accessibility or full122 acceptance.'};out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));raise SystemExit(0 if passed else 1)
