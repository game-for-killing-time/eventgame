from pathlib import Path
from PIL import Image
import numpy as np, onnxruntime as ort, hashlib
from scipy.ndimage import binary_fill_holes
model=Path.home()/'.u2net/u2net.onnx'
assert hashlib.md5(model.read_bytes()).hexdigest()=='60024c5c889badc19c04ad937298a77b', 'Unexpected model file'
options=ort.SessionOptions();options.intra_op_num_threads=2
session=ort.InferenceSession(str(model),sess_options=options,providers=['CPUExecutionProvider'])
src=Image.open('public/art/characters.png').convert('RGB')
boxes=[(40,0,350,445),(395,0,650,445),(675,0,970,445),(970,0,1325,445),(1340,0,1630,445),(20,475,342,880),(385,475,660,880),(685,475,975,880),(1020,475,1290,880),(1340,475,1620,880)]
out=Path('public/art/characters');out.mkdir(exist_ok=True)
for idx,box in enumerate(boxes):
 im=src.crop(box);a=np.asarray(im.resize((320,320),Image.Resampling.LANCZOS)).astype(float);a/=max(a.max(),1e-6)
 a=(a-np.array([.485,.456,.406]))/np.array([.229,.224,.225]);x=a.transpose(2,0,1)[None].astype('float32')
 pred=session.run(None,{session.get_inputs()[0].name:x})[0][0,0];pred=(pred-pred.min())/max(pred.max()-pred.min(),1e-6)
 alpha=Image.fromarray((np.clip(pred,0,1)*255).astype('uint8')).resize(im.size,Image.Resampling.LANCZOS)
 if idx==1:
  aa=np.asarray(alpha).copy();solid=aa>128;aa[binary_fill_holes(solid)&~solid]=255;alpha=Image.fromarray(aa)
 rgba=im.convert('RGBA');rgba.putalpha(alpha);bounds=alpha.point(lambda x:255 if x>8 else 0).getbbox()
 if bounds:rgba=rgba.crop(bounds)
 canvas=Image.new('RGBA',(256,320));rgba.thumbnail((226,292),Image.Resampling.LANCZOS);canvas.alpha_composite(rgba,((256-rgba.width)//2,306-rgba.height));canvas.save(out/f'{idx}.png');print(idx,flush=True)
