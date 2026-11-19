require("dotenv").config();
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA = path.join(ROOT, "data");
const UPLOADS = path.join(ROOT, "private_uploads");
fs.mkdirSync(DATA, {recursive:true});
fs.mkdirSync(path.join(UPLOADS,"receipts"), {recursive:true});
fs.mkdirSync(path.join(UPLOADS,"digital"), {recursive:true});
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error("Set SESSION_SECRET to a random value at least 32 characters long.");
  process.exit(1);
}
if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) {
  console.error("Set ADMIN_PASSWORD to a strong password of at least 12 characters.");
  process.exit(1);
}

const db = new Database(path.join(DATA,"shop.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS admins(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS products(
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT DEFAULT '',
 price REAL NOT NULL CHECK(price>=0), type TEXT NOT NULL CHECK(type IN ('Digital','Physical')),
 image_url TEXT DEFAULT '', stock INTEGER DEFAULT 0, active INTEGER DEFAULT 1,
 digital_file TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders(
 id INTEGER PRIMARY KEY AUTOINCREMENT, order_code TEXT UNIQUE NOT NULL, customer_name TEXT NOT NULL,
 email TEXT NOT NULL, phone TEXT DEFAULT '', address TEXT DEFAULT '', city TEXT DEFAULT '',
 payment_method TEXT NOT NULL, payment_status TEXT NOT NULL DEFAULT 'Pending',
 order_status TEXT NOT NULL DEFAULT 'Pending', receipt_file TEXT DEFAULT '',
 subtotal REAL NOT NULL, shipping REAL NOT NULL, total REAL NOT NULL,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items(
 id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES orders(id),
 product_id INTEGER, product_name TEXT NOT NULL, product_type TEXT NOT NULL,
 unit_price REAL NOT NULL, quantity INTEGER NOT NULL
);
`);
function setting(k, fallback=""){const r=db.prepare("SELECT value FROM settings WHERE key=?").get(k);return r?r.value:fallback}
function setSetting(k,v){db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(k,String(v))}
const defaults = {
 shop_name:process.env.SHOP_NAME || "YOUR BRAND",
 tagline:"A curated online store.",
 logo_url:"",
 shipping_fee:"80",
 cod_enabled:"1",
 gcash_name:"", gcash_number:"",
 maya_name:"", maya_number:"",
 contact_email:"", currency:"PHP"
};
for (const [k,v] of Object.entries(defaults)) if (setting(k) === "") setSetting(k,v);
if (!db.prepare("SELECT id FROM admins LIMIT 1").get()) {
 const email=(process.env.ADMIN_EMAIL||"owner@example.com").toLowerCase();
 db.prepare("INSERT INTO admins(email,password_hash) VALUES(?,?)").run(email,bcrypt.hashSync(process.env.ADMIN_PASSWORD,12));
}
if (!db.prepare("SELECT id FROM products LIMIT 1").get()) {
 const seed = [
  ["Digital Planner","A simple downloadable planner.",149,"Digital","https://images.unsplash.com/photo-1517842645767-c639042777db?w=900",999],
  ["Canvas Tote Bag","An everyday carry-all.",250,"Physical","https://images.unsplash.com/photo-1544816155-12df9643f363?w=900",20],
  ["E-book Collection","A digital reading collection.",199,"Digital","https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=900",999],
  ["Minimal Notebook","A notebook for notes and plans.",120,"Physical","https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=900",30]
 ];
 const ins=db.prepare("INSERT INTO products(name,description,price,type,image_url,stock) VALUES(?,?,?,?,?,?)");
 seed.forEach(p=>ins.run(...p));
}
app.set("trust proxy", 1);
app.use(helmet({contentSecurityPolicy:{directives:{
 defaultSrc:["'self'"],scriptSrc:["'self'","'unsafe-inline'"],styleSrc:["'self'","'unsafe-inline'"],
 imgSrc:["'self'","data:","https:"],connectSrc:["'self'"],objectSrc:["'none'"],upgradeInsecureRequests:null
}}}));
app.use(express.json({limit:"1mb"}));
app.use(express.urlencoded({extended:true,limit:"1mb"}));
app.use(session({
 secret:process.env.SESSION_SECRET,resave:false,saveUninitialized:false,
 cookie:{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:8*60*60*1000}
}));
app.use(express.static(path.join(ROOT,"public")));
const loginLimiter=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:true,legacyHeaders:false});
const receiptStorage=multer.diskStorage({
 destination:(req,file,cb)=>cb(null,path.join(UPLOADS,"receipts")),
 filename:(req,file,cb)=>cb(null,crypto.randomUUID()+path.extname(file.originalname).toLowerCase())
});
const digitalStorage=multer.diskStorage({
 destination:(req,file,cb)=>cb(null,path.join(UPLOADS,"digital")),
 filename:(req,file,cb)=>cb(null,crypto.randomUUID()+path.extname(file.originalname).toLowerCase())
});
const allowedImages=["image/jpeg","image/png","image/webp"];
const receiptUpload=multer({storage:receiptStorage,limits:{fileSize:5*1024*1024},fileFilter:(r,f,cb)=>cb(null,allowedImages.includes(f.mimetype))});
const digitalUpload=multer({storage:digitalStorage,limits:{fileSize:50*1024*1024},fileFilter:(r,f,cb)=>cb(null,["application/pdf","application/zip","application/octet-stream","image/jpeg","image/png"].includes(f.mimetype))});
const admin=(req,res,next)=>req.session.admin?next():res.status(401).json({error:"Admin login required."});
const publicSettings=()=>Object.fromEntries(["shop_name","tagline","logo_url","shipping_fee","cod_enabled","gcash_name","gcash_number","maya_name","maya_number","contact_email"].map(k=>[k,setting(k,defaults[k]||"")]));
app.get("/api/store",(req,res)=>res.json({settings:publicSettings(),products:db.prepare("SELECT id,name,description,price,type,image_url,stock FROM products WHERE active=1 ORDER BY id DESC").all()}));
app.post("/api/orders",receiptUpload.single("receipt"),(req,res)=>{
 try{
  const {name,email,phone="",address="",city="",paymentMethod,items}=req.body;
  if(!name||!email||!items||!paymentMethod) return res.status(400).json({error:"Please complete required checkout fields."});
  let parsed;try{parsed=JSON.parse(items)}catch{return res.status(400).json({error:"Invalid cart."})}
  if(!Array.isArray(parsed)||!parsed.length||parsed.length>30) return res.status(400).json({error:"Your cart is empty or invalid."});
  const products=[];let subtotal=0,hasPhysical=false;
  for(const line of parsed){
   const p=db.prepare("SELECT * FROM products WHERE id=? AND active=1").get(Number(line.id));
   const qty=Math.max(1,Math.min(20,Number(line.quantity)||1));
   if(!p|| (p.type==="Physical" && p.stock<qty)) return res.status(400).json({error:"A product is unavailable or has insufficient stock."});
   products.push({p,qty});subtotal+=p.price*qty;if(p.type==="Physical")hasPhysical=true;
  }
  if(hasPhysical&&(!address.trim()||!city.trim())) return res.status(400).json({error:"Delivery address and city are required for physical products."});
  if(paymentMethod==="COD" && (!hasPhysical||setting("cod_enabled","1")!=="1")) return res.status(400).json({error:"COD is unavailable for this order."});
  if(["GCash","Maya"].includes(paymentMethod)&&!req.file) return res.status(400).json({error:"Please upload your GCash or Maya payment receipt."});
  if(!["COD","GCash","Maya"].includes(paymentMethod)) return res.status(400).json({error:"Unsupported payment method."});
  const shipping=hasPhysical?Number(setting("shipping_fee","80")):0,total=subtotal+shipping;
  const code="SHOP-"+crypto.randomBytes(4).toString("hex").toUpperCase();
  const paymentStatus=paymentMethod==="COD"?"Pay on delivery":"For verification";
  const orderStatus="Pending";
  const create=db.transaction(()=>{
   const info=db.prepare(`INSERT INTO orders(order_code,customer_name,email,phone,address,city,payment_method,payment_status,order_status,receipt_file,subtotal,shipping,total)
   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(code,name,email,phone,address,city,paymentMethod,paymentStatus,orderStatus,req.file?req.file.filename:"",subtotal,shipping,total);
   const orderId=info.lastInsertRowid;
   const add=db.prepare("INSERT INTO order_items(order_id,product_id,product_name,product_type,unit_price,quantity) VALUES(?,?,?,?,?,?)");
   for(const {p,qty} of products){add.run(orderId,p.id,p.name,p.type,p.price,qty);if(p.type==="Physical")db.prepare("UPDATE products SET stock=stock-? WHERE id=?").run(qty,p.id)}
  });
  create();
  res.json({success:true,orderCode:code,message:"Order received. Keep your order code to check its status."});
 }catch(e){console.error(e);res.status(500).json({error:"Could not place order."})}
});
app.get("/api/orders/:code",(req,res)=>{
 const o=db.prepare("SELECT order_code,customer_name,email,payment_method,payment_status,order_status,total,created_at FROM orders WHERE order_code=? AND lower(email)=lower(?)").get(req.params.code,req.query.email||"");
 if(!o)return res.status(404).json({error:"Order not found. Check the order code and email."});
 const items=db.prepare("SELECT product_name,product_type,quantity FROM order_items WHERE order_id=(SELECT id FROM orders WHERE order_code=?)").all(o.order_code);
 res.json({order:o,items});
});
app.post("/api/admin/login",loginLimiter,(req,res)=>{
 const email=String(req.body.email||"").toLowerCase(),password=String(req.body.password||"");
 const a=db.prepare("SELECT * FROM admins WHERE email=?").get(email);
 if(!a||!bcrypt.compareSync(password,a.password_hash))return res.status(401).json({error:"Incorrect email or password."});
 req.session.admin={id:a.id,email:a.email};res.json({success:true,email:a.email});
});
app.post("/api/admin/logout",admin,(req,res)=>req.session.destroy(()=>res.json({success:true})));
app.get("/api/admin/me",(req,res)=>res.json({loggedIn:!!req.session.admin,email:req.session.admin?.email||""}));
app.get("/api/admin/settings",admin,(req,res)=>res.json({settings:publicSettings()}));
app.put("/api/admin/settings",admin,(req,res)=>{
 const keys=["shop_name","tagline","logo_url","shipping_fee","cod_enabled","gcash_name","gcash_number","maya_name","maya_number","contact_email"];
 for(const k of keys)if(req.body[k]!==undefined)setSetting(k,String(req.body[k]).slice(0,1000));
 res.json({success:true,settings:publicSettings()});
});
app.post("/api/admin/password",admin,(req,res)=>{
 const current=String(req.body.currentPassword||""),next=String(req.body.newPassword||"");
 const a=db.prepare("SELECT * FROM admins WHERE id=?").get(req.session.admin.id);
 if(!bcrypt.compareSync(current,a.password_hash))return res.status(400).json({error:"Current password is incorrect."});
 if(next.length<12)return res.status(400).json({error:"New password must be at least 12 characters."});
 db.prepare("UPDATE admins SET password_hash=? WHERE id=?").run(bcrypt.hashSync(next,12),a.id);
 res.json({success:true});
});
app.get("/api/admin/products",admin,(req,res)=>res.json(db.prepare("SELECT * FROM products ORDER BY id DESC").all()));
app.post("/api/admin/products",admin,(req,res)=>{
 const {name,description="",price,type,image_url="",stock=0}=req.body;
 if(!name||!["Digital","Physical"].includes(type)||!Number.isFinite(Number(price))||Number(price)<0)return res.status(400).json({error:"Enter a name, valid price, and product type."});
 const r=db.prepare("INSERT INTO products(name,description,price,type,image_url,stock) VALUES(?,?,?,?,?,?)").run(name,description,Number(price),type,image_url,Math.max(0,Number(stock)||0));
 res.json({success:true,id:r.lastInsertRowid});
});
app.put("/api/admin/products/:id",admin,(req,res)=>{
 const {name,description="",price,type,image_url="",stock=0,active=1}=req.body;
 if(!name||!["Digital","Physical"].includes(type)||Number(price)<0)return res.status(400).json({error:"Invalid product details."});
 db.prepare("UPDATE products SET name=?,description=?,price=?,type=?,image_url=?,stock=?,active=? WHERE id=?").run(name,description,Number(price),type,image_url,Math.max(0,Number(stock)||0),active?1:0,req.params.id);
 res.json({success:true});
});
app.delete("/api/admin/products/:id",admin,(req,res)=>{db.prepare("UPDATE products SET active=0 WHERE id=?").run(req.params.id);res.json({success:true})});
app.post("/api/admin/products/:id/digital-file",admin,digitalUpload.single("file"),(req,res)=>{
 if(!req.file)return res.status(400).json({error:"Upload a PDF, ZIP, or image file up to 50 MB."});
 const p=db.prepare("SELECT id,type FROM products WHERE id=?").get(req.params.id);
 if(!p||p.type!=="Digital")return res.status(400).json({error:"Choose an existing digital product."});
 db.prepare("UPDATE products SET digital_file=? WHERE id=?").run(req.file.filename,p.id);res.json({success:true});
});
app.get("/api/admin/orders",admin,(req,res)=>{
 const orders=db.prepare("SELECT * FROM orders ORDER BY id DESC").all();
 res.json(orders.map(o=>({...o,items:db.prepare("SELECT * FROM order_items WHERE order_id=?").all(o.id)})));
});
app.get("/api/admin/receipt/:id",admin,(req,res)=>{
 const o=db.prepare("SELECT receipt_file FROM orders WHERE id=?").get(req.params.id);
 if(!o||!o.receipt_file)return res.status(404).end();
 res.sendFile(path.join(UPLOADS,"receipts",path.basename(o.receipt_file)));
});
app.put("/api/admin/orders/:id",admin,(req,res)=>{
 const allowedPayment=["For verification","Verified","Rejected","Pay on delivery"];
 const allowedStatus=["Pending","Processing","Shipped","Ready for pickup","Delivered","Cancelled"];
 const {payment_status,order_status}=req.body;
 if(!allowedPayment.includes(payment_status)||!allowedStatus.includes(order_status))return res.status(400).json({error:"Invalid order update."});
 db.prepare("UPDATE orders SET payment_status=?,order_status=? WHERE id=?").run(payment_status,order_status,req.params.id);
 res.json({success:true});
});
app.get("/api/download/:code/:productId",(req,res)=>{
 const order=db.prepare("SELECT * FROM orders WHERE order_code=? AND lower(email)=lower(?)").get(req.params.code,req.query.email||"");
 if(!order||order.payment_status!=="Verified")return res.status(403).send("Payment must be verified before digital downloads are available.");
 const item=db.prepare("SELECT * FROM order_items WHERE order_id=? AND product_id=? AND product_type='Digital'").get(order.id,req.params.productId);
 const p=db.prepare("SELECT digital_file FROM products WHERE id=?").get(req.params.productId);
 if(!item||!p?.digital_file)return res.status(404).send("Digital file not available. Contact the store.");
 res.download(path.join(UPLOADS,"digital",path.basename(p.digital_file)));
});
app.use((err,req,res,next)=>{console.error(err);res.status(400).json({error:err.message||"Request failed."})});
app.listen(PORT,()=>console.log(`Shop running on port ${PORT}`));
