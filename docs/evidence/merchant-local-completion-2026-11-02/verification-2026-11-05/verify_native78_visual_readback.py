"""Read-only physical PNG checks; never rewrites or edits image files."""
from pathlib import Path
import struct,zlib,binascii,hashlib,json,base64,datetime
from qualify import ROOT,E,write

def png(path):
 data=path.read_bytes();assert data[:8]==b'\x89PNG\r\n\x1a\n';pos=8;parts=[];header=None
 while pos<len(data):
  n=struct.unpack('>I',data[pos:pos+4])[0];kind=data[pos+4:pos+8];body=data[pos+8:pos+8+n];crc=struct.unpack('>I',data[pos+8+n:pos+12+n])[0];assert binascii.crc32(kind+body)&0xffffffff==crc;pos+=n+12
  if kind==b'IHDR':header=struct.unpack('>IIBBBBB',body)
  if kind==b'IDAT':parts.append(body)
  if kind==b'IEND':break
 w,h,depth,kind,compression,filtering,interlace=header;assert 0<w<=4096 and 0<h<=4096 and depth==8 and kind in(2,6)and(compression,filtering,interlace)==(0,0,0)
 bpp=4 if kind==6 else 3;stride=w*bpp;decoded=zlib.decompress(b''.join(parts));assert len(decoded)==h*(stride+1);rows=[];prior=bytearray(stride)
 for y in range(h):
  start=y*(stride+1);ft=decoded[start];raw=decoded[start+1:start+1+stride];assert ft in range(5);row=bytearray(raw)
  if ft:
   for i,v in enumerate(raw):
    a=row[i-bpp]if i>=bpp else 0;b=prior[i];c=prior[i-bpp]if i>=bpp else 0
    if ft==1:predict=a
    elif ft==2:predict=b
    elif ft==3:predict=(a+b)//2
    else:
     p=a+b-c;da,db,dc=abs(p-a),abs(p-b),abs(p-c);predict=a if da<=db and da<=dc else b if db<=dc else c
    row[i]=(v+predict)&255
  rows.append(bytes(row));prior=row
 return w,h,bpp,rows

def pixel(img,x,y):
 w,h,bpp,rows=img;assert 0<=x<w and 0<=y<h;p=tuple(rows[y][x*bpp:(x+1)*bpp]);return p if bpp==4 else p+(255,)
def region(img,target):
 w,h,bpp,rows=img;pattern=bytes(target[:bpp]);count=0;left=w;top=h;right=bottom=-1
 for y,row in enumerate(rows):
  at=row.find(pattern)
  while at>=0:
   if at%bpp==0:
    x=at//bpp;count+=1;left=min(left,x);right=max(right,x);top=min(top,y);bottom=max(bottom,y)
   at=row.find(pattern,at+1)
 return {'pixels':count,'bounds':[left,top,right,bottom]if count else None}
def luminance(rgb):
 values=[v/255 for v in rgb[:3]];values=[v/12.92 if v<=.04045 else((v+.055)/1.055)**2.4 for v in values];return sum(v*c for v,c in zip(values,[.2126,.7152,.0722]))
def contrast(a,b):
 low,high=sorted([luminance(a),luminance(b)]);return round((high+.05)/(low+.05),4)

n=Path('/private/tmp/letbuyy-merchant-local-20261106-dzfklhx4');run=n/'native-warehouse-v78'
audit=json.loads((E/'native78-independent-readback.json').read_text());assert audit['source_sha256']=='70794e68bd47bf97c4331ab71f5a3f968231b63153cb23f0f6889ebdda31e445'
old=png(E.parent/'native77-accepted-local-kyc-media-staff/native-media-recovered-and-edited.png');new=png(run/'native-media-recovered-and-edited.png');deleted=png(run/'native-web-gallery-deletion-read.png');assert old[:2]==new[:2]==deleted[:2]==(1080,2400)
fixture=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAEklEQVR4nGOYNH3Rf2TMQLoAAOM/LKFDq3imAAAAAElFTkSuQmCC');public=json.loads((run/'native-upload-backend-verified.json').read_text());assert hashlib.sha256(fixture).hexdigest()==public['public_sha256']
expected=(146,151,162,255);shown=region(new,expected);gone=region(deleted,expected);assert shown['pixels']>40000 and gone['pixels']<1000;assert pixel(new,250,800)==expected
old_bg=pixel(old,900,2050);new_bg=pixel(new,900,2050);assert old_bg==(34,197,94,255)and new_bg==(30,41,59,255)
white=sum(pixel(new,x,y)==(255,255,255,255)for y in range(2020,2071)for x in range(170,451));assert white>200
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'ACTUAL_NATIVE_IMAGE_RENDER_REMOVAL_AND_SHARED_TOAST_PIXEL_READBACK_PASS','run_id':audit['run_id'],'source_sha256':audit['source_sha256'],'fixture_public_sha256':public['public_sha256'],'native_uploaded_image_rgba':expected,'native_rendered_image_region':shown,'native_deleted_image_color':gone,'old_success_toast_rgba':old_bg,'current_success_toast_rgba':new_bg,'current_foreground_rgba':[255,255,255,255],'actual_text_stroke_white_pixels_in_label_box':white,'old_pair_ratio':contrast(old_bg,(255,255,255,255)),'current_pair_ratio':contrast(new_bg,(255,255,255,255)),'scope':'Read-only decoding of original physical PNGs. PNG CRC/shape/filter bounds verified. Expected uploaded-image bytes tied to actual server storage SHA and rendered native pixels; normal web deletion/native refresh removes the image. Actual success toast background and white label strokes measured. This does not certify the whole app, spoken screen-reader output, other uploads or provider KYC.'}
write(E/'native78-visual-pixel-readback.json',result);print(json.dumps(result))
