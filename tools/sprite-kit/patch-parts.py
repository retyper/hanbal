"""Extract four reviewed authored patch cels and a shared standing scale anchor."""
from PIL import Image
import numpy as np
from scipy import ndimage

def four_parts(path):
    im=Image.open(path).convert('RGBA');a=np.array(im)
    labels,_=ndimage.label(a[...,3]>64,structure=np.ones((3,3)));groups={}
    for label,region in enumerate(ndimage.find_objects(labels),1):
        if region is None:continue
        ys,xs=np.nonzero(labels==label)
        if len(xs)<90:continue
        col=min(3,int(xs.mean()/(im.width/4)))
        groups.setdefault(col,[]).append(label)
    if set(groups)!=set(range(4)):raise ValueError('Expected four separate horizontal patch figures')
    parts=[]
    for col in range(4):
        mask=np.isin(labels,groups[col]);ys,xs=np.nonzero(mask)
        box=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]
        if min(box[:2])<2 or box[2]>im.width-2 or box[3]>im.height-2:raise ValueError('Patch canvas clipping')
        rgba=a.copy();rgba[~ndimage.binary_dilation(mask,iterations=2),3]=0
        parts.append((Image.fromarray(rgba).crop(box),box,float(xs.mean())))
    return parts
