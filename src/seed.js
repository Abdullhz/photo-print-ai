// الأسعار الافتراضية — تُنسخ إلى ملف البيانات عند أول تشغيل فقط، ثم يعدّلها المدير من لوحة التحكم.
export const seedServices = [
  { id: 'portrait-session', category: 'تصوير', name: 'جلسة تصوير شخصية (استوديو)', price: 250, unit: 'جلسة', description: 'ساعة تصوير داخل الاستوديو مع 10 صور معدّلة.' },
  { id: 'family-session', category: 'تصوير', name: 'جلسة تصوير عائلية', price: 400, unit: 'جلسة', description: 'حتى 6 أشخاص، ساعة ونصف، 20 صورة معدّلة.' },
  { id: 'event-photography', category: 'تصوير', name: 'تصوير المناسبات والحفلات', price: 1500, unit: 'مناسبة (4 ساعات)', description: 'مصوّر محترف لمدة 4 ساعات مع تسليم الصور خلال 7 أيام.' },
  { id: 'product-photography', category: 'تصوير', name: 'تصوير المنتجات', price: 35, unit: 'منتج', description: 'خلفية بيضاء، 3 زوايا لكل منتج، مناسب للمتاجر الإلكترونية.' },
  { id: 'id-photos', category: 'تصوير', name: 'صور شخصية للجواز والهوية', price: 25, unit: '6 صور', description: 'بالمقاسات الرسمية وتسليم فوري.' },
  { id: 'print-10x15', category: 'طباعة صور', name: 'طباعة صور 10×15 سم', price: 2, unit: 'صورة', description: 'ورق فوتوغرافي لامع أو مطفي.' },
  { id: 'print-a4', category: 'طباعة صور', name: 'طباعة صور A4', price: 15, unit: 'صورة', description: 'ورق فوتوغرافي عالي الجودة.' },
  { id: 'canvas-50x70', category: 'طباعة صور', name: 'لوحة كانفس 50×70 سم', price: 180, unit: 'لوحة', description: 'قماش كانفس مشدود على إطار خشبي جاهز للتعليق.' },
  { id: 'photo-album', category: 'طباعة صور', name: 'ألبوم صور فاخر (30 صفحة)', price: 450, unit: 'ألبوم', description: 'غلاف جلدي مع طباعة اسم، صفحات سميكة.' },
  { id: 'business-cards', category: 'مطبوعات تجارية', name: 'بطاقات أعمال', price: 120, unit: '500 بطاقة', description: 'كرتون 350 جرام، طباعة وجهين.' },
  { id: 'flyers-a5', category: 'مطبوعات تجارية', name: 'فلايرات A5', price: 250, unit: '1000 نسخة', description: 'ورق 150 جرام لامع، طباعة وجهين.' },
  { id: 'rollup-banner', category: 'مطبوعات تجارية', name: 'رول أب 85×200 سم', price: 220, unit: 'قطعة', description: 'يشمل الحامل والحقيبة.' },
  { id: 'large-format', category: 'مطبوعات تجارية', name: 'طباعة لوحات كبيرة (فليكس)', price: 45, unit: 'متر مربع', description: 'للواجهات والإعلانات الخارجية.' },
  { id: 'photo-retouch', category: 'تصميم وتعديل', name: 'تعديل وتحسين الصور', price: 20, unit: 'صورة', description: 'تصحيح ألوان وإضاءة وإزالة شوائب.' },
  { id: 'print-design', category: 'تصميم وتعديل', name: 'تصميم مطبوعة', price: 150, unit: 'تصميم', description: 'تصميم بطاقة أو فلاير أو بنر مع تعديلين مجانيين.' },
];
