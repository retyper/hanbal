"""Bake user H01/H06/H07/H08/H09 into runtime assets; never modify Downloads."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib, json

root = Path(__file__).resolve().parent.parent
source = Path.home() / 'Downloads'
out = root / 'public/realm/raid'
out.mkdir(exist_ok=True)
records = []
def load(n, variant=''):
    p = source / ('haebi-pack-v1-H%02d%s.png.png' % (n, variant))
    im = Image.open(p).convert('RGBA')
    records.append({'source': p.name, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'size': im.size})
    return im

load(1).convert('RGB').resize((1440,810), Image.Resampling.LANCZOS).save(out/'forest.webp',quality=88)
axe = load(6)
box = axe.getchannel('A').point(lambda x: 255 if x > 8 else 0).getbbox()
axe = axe.crop(box); axe.thumbnail((144,144),Image.Resampling.LANCZOS)
tile = Image.new('RGBA',(160,160)); tile.alpha_composite(axe,((160-axe.width)//2,(160-axe.height)//2)); tile.save(out/'axe.png')

def cells(im, cols, rows):
    for y in range(rows):
        for x in range(cols):
            yield im.crop((round(x*im.width/cols),round(y*im.height/rows),round((x+1)*im.width/cols),round((y+1)*im.height/rows)))

# Preserve expansion sizes across time, but remove the generator's uneven cell margins.
parts = list(cells(load(9),4,2))
boxes = [im.getchannel('A').point(lambda x: 255 if x > 8 else 0).getbbox() for im in parts]
scale = 224 / max(max(b[2]-b[0],b[3]-b[1]) for b in boxes)
strip = Image.new('RGBA',(256*8,256))
for i,(im,b) in enumerate(zip(parts,boxes)):
    im = im.crop(b); im = im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
    strip.alpha_composite(im,(i*256+(256-im.width)//2,(256-im.height)//2))
strip.save(out/'impact-strip.png')
for im,name in zip(cells(load(7),2,2), ['cyclone','inferno','torrent','breakthrough']):
    im = im.crop(im.getbbox()); im.thumbnail((80,80),Image.Resampling.LANCZOS)
    tile = Image.new('RGBA',(96,96)); tile.alpha_composite(im,((96-im.width)//2,(96-im.height)//2)); tile.save(out/(name+'.png'))
for im,name in zip(cells(load(8),3,2), ['essence','essence-large','rice','charm','coins','chest']):
    im = im.crop(im.getbbox()); im.thumbnail((48,48),Image.Resampling.LANCZOS)
    tile = Image.new('RGBA',(56,56)); tile.alpha_composite(im,((56-im.width)//2,(56-im.height)//2)); tile.save(out/(name+'.png'))
# New effects retain ONE source-coordinate origin and scale across all frames.
# Per-frame tight fitting would make the effect wobble and inflate fading particles.
fx_meta = {}
def effect(n, name, origin, variant=''):
    parts = list(cells(load(n,variant),4,2)); cw,ch = parts[0].size
    ox,oy = origin[0]*cw,origin[1]*ch
    boxes = [p.getchannel('A').point(lambda a:255 if a>8 else 0).getbbox() for p in parts]
    extent = max(max(abs(b[0]-ox),abs(b[2]-ox),abs(b[1]-oy),abs(b[3]-oy)) for b in boxes if b)
    scale = 116 / extent
    strip = Image.new('RGBA',(2048,256))
    for i,p in enumerate(parts):
        p.putalpha(p.getchannel('A').point(lambda a:a if a>8 else 0))
        p = p.resize((round(p.width*scale),round(p.height*scale)),Image.Resampling.LANCZOS)
        strip.alpha_composite(p,(i*256+round(128-ox*scale),round(128-oy*scale)))
    strip.save(out/(name+'-strip.png'))
    fx_meta[name] = {'frames':8,'cell':256,'sourceOrigin':origin,'scale':scale,'anchor':[128,128]}
effect(13,'slash',(.16,.5),'-2')
effect(14,'death',(.5,.69))
effect(15,'fire',(.5,.70))
# Endpoints are tightly authored at x~46/404. Preserve these endpoints, not glow bounds.
parts=list(cells(load(16),4,2)); strip=Image.new('RGBA',(2048,128))
for i,p in enumerate(parts):
    p=p.crop((44,150,408,310)).resize((256,113),Image.Resampling.LANCZOS)
    strip.alpha_composite(p,(i*256,7))
strip.save(out/'lightning-strip.png')
fx_meta['lightning']={'frames':8,'width':256,'height':128,'anchor':'left/right center'}

def icon(im,name,size=96,padding=8):
    b=im.getchannel('A').point(lambda a:255 if a>8 else 0).getbbox()
    if not b: raise ValueError(name+' empty')
    im=im.crop(b);im.thumbnail((size-padding*2,size-padding*2),Image.Resampling.LANCZOS)
    tile=Image.new('RGBA',(size,size));tile.alpha_composite(im,((size-im.width)//2,(size-im.height)//2));tile.save(out/(name+'.png'))
for p,name in zip(cells(load(17),2,2),['talisman','wind-blade','arrow','hit']): icon(p,name,96,6)
for p,name in zip(cells(load(18),4,2),['power-axe','power-gale','power-ember','power-thunder','power-echo','power-tempo','power-reach','power-skill']): icon(p,name)
# H19 is a hand-arranged atlas rather than equal quadrants; use measured clear gutters.
ui=load(19)
for name,box,width in [('ui-slot',(0,0,550,530),128),('ui-health',(560,180,1254,350),640),('ui-card',(0,550,550,1254),192),('ui-tooltip',(560,700,1254,1100),384)]:
    p=ui.crop(box);p=p.crop(p.getchannel('A').point(lambda a:255 if a>8 else 0).getbbox())
    p.resize((width,round(p.height*width/p.width)),Image.Resampling.LANCZOS).save(out/(name+'.png'))
(out/'intake.json').write_text(json.dumps({'sources':records,'impact':{'frames':8,'width':256,'height':256,'aligned':'alpha bounds center, shared scale'},'effects':fx_meta},indent=2),encoding='utf8')
print('Baked forest, weapon, effects, HUD, power and drop icons:',out)
