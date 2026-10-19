# متابعة إصلاح قضايا PandaSpigot

آخر تحديث: 2026-10-19. التقرير المرجعي هو [issue-status.md](issue-status.md).

- [x] مراجعة القضايا المفتوحة الـ33 مع التعليقات والتعديلات المحلية.
- [x] إنهاء عائق البناء وتشغيل check/assemble بنجاح.
- [x] آخر نتائج المكونات: 6,450 اختبارًا ناجحًا، صفر فشل، 3 اختبارات API متجاوزة؛ smoke compile ناجح. يشمل 13 اختبار ViaAck بعد تحديث 1.0.1.
- [x] إصلاح ترتيب ACK في main thread وفي طابور الشبكة الخارج، بما يشمل packets المؤجلة.
- [x] تشغيل ViaVersion 5.12.1 مع بروتوكول 1.21.11: 80 placement ورفض واحد، كل تحديث بلوك قبل ACK.
- [x] اختبار placement أصلي 1.8.9 و3 دورات إعادة تتبع عتاد بعميلين.
- [x] إضافة وتوثيق خيارات gameplay/performance، بما فيها XorShift وredstone scheduled tick toggle.
- [x] تصدير server patches 0139–0148 وAPI patches 0034–0037 والتحقق من إعادة تطبيقها بشجرة مطابقة.
- [x] تجربة mappings #413 في نسخة منفصلة وتسجيل تعارضات الترجمة بدل دمج مصدر مكسور.
- [x] تجهيز jars التسليم وSHA-256 وتعليمات التركيب.
- [ ] تجربة الفيديو رسوميًا في سيرفر المستخدم مع إضافاته وlatency/low TPS الفعلية.
- [ ] #69: الحصول على packet/stack trace محدد لكل crash.
- [ ] #104: حالات مستقلة للـLOS والأسهم وhitbox overlaps؛ إصلاح chunk membership لا يغطيها كلها.
- [ ] #164: benchmark وتحسين تجمع falling blocks داخل cobweb دون تعطيل الفيزياء.
- [ ] #344: إعادة إنتاج rotation/placement race وإصلاحه مع الحفاظ على ترتيب البروتوكول.
- [ ] #413: إزالة تعارضات mappings وpackage access ثم إثبات round-trip كامل.
- [ ] تأكيد الحالات التفصيلية لـ#408 مع إضافات الدخول، و#431 بعد unload/reload، وUnix sockets على Linux.

- [x] إصلاح SWM package sealing في patch 0149، مع اختبار JAR واختبار تشغيل قبل/بعد على Java 21؛ التسليم r2.
- [x] إصلاح تهيئة ViaAck في 1.0.1؛ إعادة إنتاج الخطأ القديم وتأخير Via بـ40 ticks، واختبار late enable والمزوّد الأساسي وإرجاع الأصلي، وتشغيل ViaVersion/ViaBackwards 5.5.1. إعادة اختبار 81 ACK مع 1.21.11 وViaVersion 5.12.1 وSWM ناجحة؛ التسليم r3 يعيد استخدام سيرفر r2.
