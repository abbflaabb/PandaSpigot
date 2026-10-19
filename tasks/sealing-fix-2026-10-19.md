# إصلاح تعارض SlimeWorldManager مع package sealing

تاريخ الإصلاح: 2026-10-19. patch: `0149-Scope-package-sealing-to-Bukkit-and-verify-the-packa.patch`.

## السبب والإصلاح

الـManifest السابق احتوى `Name: org/bukkit/` و`Sealed: true` داخل القسم الرئيسي. ذلك جعل كل الحزم، بما فيها `org.yaml.snakeyaml.util`، مختومة. يضيف SWM classmodifier أصناف SnakeYAML أخرى إلى class loader نفسه، ومنها PlatformFeatureDetector غير الموجود في نسخة السيرفر؛ تحميلها من JAR آخر بعد تحميل UriEncoder أدى إلى الخطأ المرسل.

أُصلح تعريف Gradle لإنشاء قسم مستقل باسم `org/bukkit/` يحتوي `Sealed: true`. تبقى حزمة Bukkit مختومة، بينما لا تُختم المكتبات المضمّنة كلها. هذا يوافق [قواعد package sealing في مواصفة JAR](https://docs.oracle.com/en/java/javase/17/docs/specs/jar/jar.html#package-sealing). لم تُستبدل مكتبة SnakeYAML أو ملفات SlimeWorldManager أو إعدادات السيرفر الفعلي.

## الإثبات

- اختبار `PackageSealingSmokeTest` يفشل بالـJAR القديم بنفس SecurityException وينجح بالـJAR الجديد. يتحقق أيضًا من استمرار رفض إدخال أصناف خارجية إلى حزمة Bukkit المختومة.
- أصبح الاختبار جزءًا من `:pandaspigot-server:check` ويعمل على ملف السيرفر النهائي بعد shading/remapping، حتى يلتقط أخطاء التغليف التي لا تظهر على classpath اختبارات الوحدات.
- شُغّل SlimeWorldManager **2.2.1** والـclassmodifier من مجلد BedWars23 باستخدام **Java 21.0.10** في مجلد اختبار منفصل ومنفذ localhost 25578. تكرر نفس خطأ المستخدم قبل الإصلاح. بعده اكتمل تحميل SWM وتشغيل السيرفر وإغلاقه دون خطأ التحميل.
- نُفذ اختبار مشترك مع SlimeWorldManager وViaVersion 5.12.1 وViaAck على Java 21. شمل البناء السريع 1.21.11 وعميل 1.8.9 وإعادة تتبع العتاد.
- `check` للسيرفر والـAPI وViaAck نجح. بقيت اختبارات الوحدات السابقة up-to-date لأن التعديل في التغليف فقط؛ اختبار التغليف الجديد واختبارات التشغيل أُعيد تنفيذها.
- أُعيد تطبيق patch 0149 على نسخة التحقق، وتطابقت شجرة المصدر الناتجة.

## الملفات

النسخة المصححة في `build/releases/2026-10-19-r2/PandaSpigot-1.8.8-2026-10-19-r2.jar`.

أوقف السيرفر واستبدل server.jar بهذه النسخة ثم أعد التشغيل بنفس أمر التشغيل الذي يستخدم classmodifier. تبقى إضافة PandaSpigotViaAck السابقة صالحة، ولا يلزم استبدال SlimeWorldManager أو الـclassmodifier. ملفات وإعدادات BedWars23 الأصلية لم تُعدّل.

سجلات المقارنة: `build/issue-audit/swm-sealing/before/` و`after/`.
نتيجة الاختبار المشترك: `build/issue-audit/sealing-fix-bridge.log` وسجل `live-server/integration-server.log`.
