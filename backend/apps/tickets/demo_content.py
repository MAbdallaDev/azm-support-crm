"""Bilingual corpus for `manage.py seed_demo`.

Kept out of the command module so the command reads as logic and this reads as
content. Every Arabic string here is written Arabic, not machine translation and
not placeholder text — the knowledge base is one of the screens a reviewer will
read in Arabic, and `docs/design/KBEditor.dc.html` shows the article body in full.
"""

# --------------------------------------------------------------------------
# Organisation
# --------------------------------------------------------------------------

DEPARTMENTS = [
    ("billing", "Billing", "الفوترة"),
    ("technical", "Technical Support", "الدعم الفني"),
    ("general", "General Enquiries", "الاستفسارات العامة"),
]

BRANCHES = [
    ("riyadh", "Riyadh", "الرياض"),
    ("jeddah", "Jeddah", "جدة"),
    ("dammam", "Dammam", "الدمام"),
]

# --------------------------------------------------------------------------
# Staff. The four role logins come first; the rest give story 09's
# agent-performance table more than one row to rank.
# --------------------------------------------------------------------------

DEMO_PASSWORD = "Demo!2345"

STAFF = [
    # username, first, last, role, dept, branch, tier, language, superuser, staff
    ("admin@demo", "Mostafa", "Abdallah", "admin", "general", "riyadh", 3, "en", True, True),
    ("manager@demo", "Layla", "Al-Harbi", "manager", "general", "riyadh", 3, "ar", False, True),
    ("agent@demo", "Yousef", "Al-Qahtani", "agent", "technical", "riyadh", 2, "en", False, True),
    ("sara@demo", "Sara", "Al-Otaibi", "agent", "billing", "riyadh", 2, "ar", False, True),
    ("khalid@demo", "Khalid", "Al-Dossary", "agent", "technical", "jeddah", 1, "en", False, True),
    ("noura@demo", "Noura", "Al-Shammari", "agent", "billing", "jeddah", 2, "ar", False, True),
    ("faisal@demo", "Faisal", "Al-Ghamdi", "agent", "general", "dammam", 1, "en", False, True),
    ("omar@demo", "Omar", "Al-Zahrani", "agent", "technical", "dammam", 3, "ar", False, True),
]

CUSTOMER_LOGIN = ("customer@demo", "Hind", "Al-Subaie", "customer", "ar")

# --------------------------------------------------------------------------
# Customers. Natural key is `email` — the seed re-keys on it every run.
# --------------------------------------------------------------------------

CUSTOMERS = [
    # email, name, company, tier, branch, language, phone, whatsapp
    ("ops@gulftrading.sa", "Abdulaziz Al-Rashid", "Arabian Gulf Trading Co.",
     "enterprise", "riyadh", "ar", "+966 11 462 7710", "+966 55 462 7710"),
    ("support@najdlogistics.sa", "Hind Al-Subaie", "Najd Logistics",
     "enterprise", "dammam", "ar", "+966 13 833 2140", "+966 50 833 2140"),
    ("hello@redseahospitality.com", "Marwan Sabbagh", "Red Sea Hospitality Group",
     "enterprise", "jeddah", "en", "+966 12 611 9082", "+966 54 611 9082"),
    ("accounts@tahalufmedical.sa", "Reem Al-Juhani", "Tahaluf Medical Supplies",
     "premium", "riyadh", "ar", "+966 11 209 3355", "+966 56 209 3355"),
    ("team@almahadigital.com", "Ziad Barakat", "Almaha Digital",
     "premium", "jeddah", "en", "+966 12 774 5501", "+966 53 774 5501"),
    ("it@sadeemcloud.sa", "Bandar Al-Mutairi", "Sadeem Cloud Services",
     "premium", "riyadh", "en", "+966 11 558 0192", "+966 55 558 0192"),
    ("info@baytalnoor.sa", "Manal Al-Amoudi", "Bayt Al-Noor Furnishing",
     "standard", "jeddah", "ar", "+966 12 640 1177", "+966 59 640 1177"),
    ("admin@rawabicontracting.sa", "Turki Al-Harthy", "Rawabi Contracting",
     "standard", "dammam", "ar", "+966 13 891 4408", "+966 50 891 4408"),
    ("contact@manazelre.sa", "Ghada Al-Sudairy", "Manazel Real Estate",
     "standard", "riyadh", "ar", "+966 11 330 7726", "+966 58 330 7726"),
    ("office@qimamedu.sa", "Salman Al-Anzi", "Qimam Education",
     "standard", "dammam", "en", "+966 13 720 6614", "+966 55 720 6614"),
]

# customer email -> [(name, position, is_primary), ...]
CONTACTS = {
    "ops@gulftrading.sa": [
        ("Abdulaziz Al-Rashid", "Operations Director", True),
        ("Fatimah Al-Nasser", "Finance Manager", False),
        ("Tariq Bin Saleh", "IT Coordinator", False),
    ],
    "support@najdlogistics.sa": [
        ("Hind Al-Subaie", "Head of Customer Service", True),
        ("Majed Al-Faraj", "Fleet Supervisor", False),
    ],
    "hello@redseahospitality.com": [
        ("Marwan Sabbagh", "Group IT Manager", True),
        ("Dana Khoury", "Front Office Manager", False),
        ("Ahmed Fathy", "Revenue Analyst", False),
    ],
    "accounts@tahalufmedical.sa": [
        ("Reem Al-Juhani", "Accounts Payable Lead", True),
        ("Ibrahim Al-Sayed", "Procurement Officer", False),
    ],
    "team@almahadigital.com": [("Ziad Barakat", "Founder", True)],
    "it@sadeemcloud.sa": [
        ("Bandar Al-Mutairi", "Platform Lead", True),
        ("Lama Al-Qadi", "Support Engineer", False),
    ],
    "info@baytalnoor.sa": [("Manal Al-Amoudi", "Owner", True)],
    "admin@rawabicontracting.sa": [
        ("Turki Al-Harthy", "Office Manager", True),
        ("Saeed Al-Balawi", "Site Accountant", False),
    ],
    "contact@manazelre.sa": [("Ghada Al-Sudairy", "Leasing Manager", True)],
    "office@qimamedu.sa": [
        ("Salman Al-Anzi", "Registrar", True),
        ("Wafa Al-Hazmi", "Bursar", False),
    ],
}

CUSTOMER_NOTES = [
    "Prefers a phone call before any change to the billing cycle. Do not switch them to "
    "email-only notifications without checking first.",
    "Renewal is up in Q1. Keep escalations visible to the account manager.",
    "Their finance team works Sunday to Thursday, 08:00–15:00 Riyadh time. Anything raised "
    "after Thursday noon will not be seen until Sunday.",
    "Arabic is their working language — reply in Arabic unless the ticket was opened in English.",
    "Migrated from the legacy portal in March; some of their older invoices still carry the "
    "old numbering scheme.",
    "Two open change requests with the platform team. Check before promising a delivery date.",
]

# --------------------------------------------------------------------------
# Ticket taxonomy
# --------------------------------------------------------------------------

CATEGORIES = [
    ("billing-invoice", "Invoices & Billing", "الفواتير والفوترة", "normal"),
    ("payments", "Payments & Refunds", "المدفوعات والاستردادات", "high"),
    ("account-access", "Account & Access", "الحساب وتسجيل الدخول", "high"),
    ("technical-fault", "Technical Fault", "عطل فني", "urgent"),
    ("notifications", "Notifications & Messaging", "الإشعارات والرسائل", "normal"),
    ("feature-request", "Feature Request", "طلب ميزة", "low"),
    ("onboarding", "Onboarding & Setup", "التهيئة والإعداد", "normal"),
]

TAGS = [
    ("vip", "VIP", "عميل مميز", "#b45309"),
    ("refund", "Refund", "استرداد", "#0f766e"),
    ("bug", "Bug", "خلل برمجي", "#b91c1c"),
    ("arabic", "Arabic content", "محتوى عربي", "#6d28d9"),
    ("integration", "Integration", "تكامل", "#1d4ed8"),
    ("follow-up", "Follow-up", "متابعة", "#64748b"),
    ("duplicate", "Duplicate", "مكرر", "#475569"),
    ("data-fix", "Data fix", "تصحيح بيانات", "#047857"),
]

# name, tier, priority, first_response_minutes, resolution_minutes, escalate_at_percent
SLA_POLICIES = [
    ("Enterprise-P1", "enterprise", "urgent", 30, 480, 90),
    ("Enterprise-P2", "enterprise", "high", 60, 720, 90),
    ("Enterprise-Normal", "enterprise", "normal", 120, 1440, 90),
    ("Enterprise-P4", "enterprise", "low", 240, 2880, 85),
    ("Premium-P1", "premium", "urgent", 60, 720, 90),
    ("Premium-P2", "premium", "high", 120, 1440, 90),
    ("Premium-Normal", "premium", "normal", 240, 2880, 85),
    ("Premium-P4", "premium", "low", 480, 4320, 85),
    ("Standard-P1", "standard", "urgent", 120, 1440, 90),
    ("Standard-P2", "standard", "high", 240, 2880, 85),
    ("Standard-Normal", "standard", "normal", 480, 4320, 80),
    ("Standard-P4", "standard", "low", 960, 7200, 80),
]

# --------------------------------------------------------------------------
# Canned replies — the composer chips in `docs/design/Main.dc.html`
# --------------------------------------------------------------------------

CANNED_REPLIES = [
    (
        "ack-eta", "billing-invoice",
        "Acknowledge + ETA", "إقرار بالاستلام مع الوقت المتوقع",
        "Thank you for getting in touch. I have your request and I am looking into it now. "
        "I expect to have an update for you within the next two working hours, and I will "
        "write again as soon as I know more.",
        "شكرًا لتواصلك معنا. وصلني طلبك وأعمل على متابعته الآن، وأتوقع أن أوافيك بتحديث خلال "
        "ساعتَي عمل، وسأكتب إليك فور توفر أي جديد.",
    ),
    (
        "invoice-number", "billing-invoice",
        "Request invoice number", "طلب رقم الفاتورة",
        "To pull up the right record, could you send me the invoice number? It appears at the "
        "top right of the invoice PDF and starts with INV-. The billing month on its own is not "
        "enough to identify it when there is more than one invoice in the same period.",
        "حتى أتمكن من الوصول إلى السجل الصحيح، أرجو تزويدي برقم الفاتورة. يظهر الرقم في أعلى "
        "يسار ملف الفاتورة ويبدأ بـ INV-. شهر الفوترة وحده لا يكفي للتعرف على الفاتورة عند وجود "
        "أكثر من فاتورة في الفترة نفسها.",
    ),
    (
        "payment-link", "payments",
        "Payment link sent", "تم إرسال رابط الدفع",
        "I have just sent a secure payment link to the email address on your account. The link "
        "stays valid for 24 hours. Once the payment clears, the service resumes automatically — "
        "there is nothing further you need to do on your side.",
        "أرسلت للتو رابط دفع آمن إلى البريد الإلكتروني المسجل في حسابك، والرابط صالح لمدة أربع "
        "وعشرين ساعة. وبمجرد اكتمال عملية الدفع تُستأنف الخدمة تلقائيًا دون أي إجراء إضافي من طرفك.",
    ),
    (
        "escalate-billing", "billing-invoice",
        "Escalating to billing", "تصعيد إلى قسم الفوترة",
        "This one needs the billing team to look at the account directly, so I am passing it to "
        "them now. They work Sunday to Thursday and normally respond the same working day. The "
        "ticket stays open and you will keep receiving updates here.",
        "تحتاج هذه الحالة إلى مراجعة مباشرة من فريق الفوترة، وقد حوّلتها إليهم الآن. يعمل الفريق "
        "من الأحد إلى الخميس ويردّ عادةً في يوم العمل نفسه. تبقى التذكرة مفتوحة وستصلك التحديثات هنا.",
    ),
    (
        "confirm-resolved", "general-followup",
        "Ask to confirm resolved", "طلب تأكيد الحل",
        "The change is now live on your account and I can see it working from our side. Could "
        "you confirm it looks right to you as well? If I do not hear back within three working "
        "days I will close the ticket, and you can reopen it at any time by replying here.",
        "أصبح التعديل ساريًا على حسابك، وأتحقق من عمله بشكل سليم من جهتنا. هل يمكنك تأكيد أن كل "
        "شيء يبدو صحيحًا من جهتك أيضًا؟ في حال عدم ورود ردّ خلال ثلاثة أيام عمل سأغلق التذكرة، "
        "ويمكنك إعادة فتحها في أي وقت بالرد على هذه الرسالة.",
    ),
    (
        "need-details", "technical-fault",
        "Request more details", "طلب تفاصيل إضافية",
        "So that I can reproduce what you are seeing, could you tell me the exact time it "
        "happened, the browser or app you were using, and whether it affects one user or "
        "everyone in the account? A screenshot of the error message helps a great deal.",
        "حتى أتمكن من إعادة إنتاج المشكلة كما ظهرت لديك، أرجو إفادتي بوقت حدوثها بالتحديد، "
        "والمتصفح أو التطبيق المستخدم، وما إذا كانت تؤثر على مستخدم واحد أم على جميع مستخدمي "
        "الحساب. كما تساعدنا كثيرًا صورة من رسالة الخطأ.",
    ),
    (
        "outside-hours", "general-followup",
        "Outside business hours", "خارج ساعات العمل",
        "Your message reached us outside working hours. Our team is available Sunday to "
        "Thursday, 08:00 to 17:00 Riyadh time. Your ticket is already in the queue and will be "
        "picked up first thing on the next working day.",
        "وصلتنا رسالتك خارج ساعات العمل. فريقنا متاح من الأحد إلى الخميس، من الثامنة صباحًا حتى "
        "الخامسة مساءً بتوقيت الرياض. تذكرتك مسجّلة في قائمة الانتظار وسيبدأ العمل عليها مع بداية "
        "يوم العمل التالي.",
    ),
]

# --------------------------------------------------------------------------
# Knowledge base
# --------------------------------------------------------------------------

KB_CATEGORIES = [
    ("billing", "Billing & Invoices", "الفوترة والفواتير", 1),
    ("technical", "Technical Issues", "المشكلات التقنية", 2),
    ("account", "Account & Administration", "الحساب والإدارة", 3),
    ("getting-started", "Getting Started", "البدء والاستخدام", 4),
]

# slug, category, status, title_en, title_ar, body_en, body_ar
KB_ARTICLES = [
    (
        "delayed-sms-notifications", "technical", "published",
        "Why SMS notifications sometimes arrive late",
        "لماذا تصل إشعارات الرسائل النصية متأخرة أحيانًا؟",
        "An SMS notification leaves our system within seconds of the event that triggered it. "
        "The delay you see is almost always added afterwards, by the mobile operator's own "
        "queue.\n\n"
        "Three causes account for nearly every late message. The first is operator throttling: "
        "at peak hours a network will hold bulk traffic behind person-to-person traffic, which "
        "can add anything from a minute to half an hour. The second is a roaming handset — a "
        "message addressed to a number that is currently abroad travels through the visited "
        "network and is frequently delayed. The third is a full inbox on the handset itself, "
        "which causes the operator to retry on a fixed schedule rather than deliver immediately."
        "\n\n"
        "To tell the difference, open the ticket and compare the *sent* timestamp on the "
        "notification with the time the recipient says the message arrived. If the sent "
        "timestamp is within a few seconds of the event, the delay is downstream of us and the "
        "operator is the right party to chase. If the sent timestamp itself is late, raise a "
        "ticket under Notifications & Messaging and include the recipient number.\n\n"
        "Customers who need a guaranteed arrival time should use email or portal notifications "
        "instead. SMS is a best-effort channel by design and no operator offers a delivery-time "
        "guarantee for bulk traffic.",
        "تغادر الرسالة النصية نظامنا خلال ثوانٍ من وقوع الحدث الذي أطلقها، والتأخير الذي تلاحظه "
        "يُضاف بعد ذلك في الغالب داخل طابور مشغّل الشبكة نفسه.\n\n"
        "تفسّر ثلاثة أسباب معظم حالات التأخير. الأول هو تنظيم المشغّل لحركة الرسائل: ففي ساعات "
        "الذروة تُؤخَّر الرسائل الجماعية خلف الرسائل الشخصية، وقد يضيف ذلك من دقيقة إلى نصف ساعة. "
        "والثاني هو وجود الهاتف في وضع التجوال، إذ تمرّ الرسالة عبر الشبكة المُزارة وكثيرًا ما "
        "تتأخر. والثالث هو امتلاء صندوق الرسائل في الهاتف، ما يدفع المشغّل إلى إعادة المحاولة "
        "وفق جدول ثابت بدلًا من التسليم الفوري.\n\n"
        "للتفريق بين هذه الحالات، افتح التذكرة وقارن وقت الإرسال المسجَّل على الإشعار بالوقت الذي "
        "يذكر المستلم أنه استلم فيه الرسالة. فإذا كان وقت الإرسال قريبًا من وقت الحدث بثوانٍ، فإن "
        "التأخير خارج نطاقنا والمشغّل هو الجهة المعنية بالمتابعة. أما إذا كان وقت الإرسال نفسه "
        "متأخرًا، فارفع تذكرة تحت تصنيف «الإشعارات والرسائل» مع إرفاق رقم المستلم.\n\n"
        "ننصح العملاء الذين يحتاجون إلى وقت وصول مضمون باستخدام البريد الإلكتروني أو إشعارات "
        "البوابة، فالرسائل النصية قناة تعمل بأفضل جهد ممكن ولا يقدّم أي مشغّل ضمانًا لزمن التسليم "
        "في الحركة الجماعية.",
    ),
    (
        "arabic-invoice-template", "billing", "published",
        "Setting up an Arabic invoice template",
        "إعداد قالب فاتورة باللغة العربية",
        "Arabic invoices are a separate template, not a translation toggle on the English one. "
        "This is deliberate: a ZATCA-compliant Arabic invoice has a different field order, and "
        "flipping an English layout right-to-left produces a document that is technically "
        "bilingual and practically unreadable.\n\n"
        "To create one, open Settings → Billing → Templates and choose *New template*. Set the "
        "language to Arabic before you add any fields — the field picker changes with the "
        "language, and switching afterwards clears the layout. Add the seller and buyer VAT "
        "numbers, the invoice number, the issue date in both Hijri and Gregorian, and the line "
        "items. The QR code block is added automatically and cannot be removed.\n\n"
        "Assign the template per customer rather than globally. On the customer record, set "
        "*Preferred language* to Arabic and the Arabic template is selected for every invoice "
        "issued to that account from then on. Existing invoices are not regenerated; they keep "
        "the template they were issued under, which is the correct behaviour for an accounting "
        "document.\n\n"
        "If the Arabic text renders as disconnected letters in the downloaded PDF, the template "
        "is using a font without an Arabic cut. Change the template font to IBM Plex Sans Arabic "
        "and re-download.",
        "الفاتورة العربية قالب مستقل، وليست مجرد خيار ترجمة للقالب الإنجليزي. وهذا اختيار مقصود، "
        "فالفاتورة العربية المتوافقة مع متطلبات هيئة الزكاة والضريبة والجمارك لها ترتيب حقول "
        "مختلف، وقلب التصميم الإنجليزي من اليمين إلى اليسار ينتج مستندًا ثنائي اللغة شكلًا وغير "
        "قابل للقراءة عمليًا.\n\n"
        "لإنشاء القالب، افتح الإعدادات ← الفوترة ← القوالب واختر «قالب جديد». حدّد اللغة العربية "
        "قبل إضافة أي حقل، لأن قائمة الحقول تتغيّر بتغيّر اللغة، والتبديل بعد الإضافة يمسح "
        "التنسيق. أضف الرقم الضريبي للبائع والمشتري، ورقم الفاتورة، وتاريخ الإصدار بالتقويمين "
        "الهجري والميلادي، ثم بنود الفاتورة. أما مربع رمز الاستجابة السريعة فيُضاف تلقائيًا ولا "
        "يمكن حذفه.\n\n"
        "اربط القالب بالعميل لا بالنظام كله. من سجل العميل، اضبط «اللغة المفضّلة» على العربية، "
        "فيُختار القالب العربي لكل فاتورة تُصدر لهذا الحساب بعد ذلك. ولا يُعاد إنشاء الفواتير "
        "السابقة، بل تبقى على القالب الذي صدرت به، وهو السلوك الصحيح لأي مستند محاسبي.\n\n"
        "وإذا ظهر النص العربي بحروف متقطعة في ملف الفاتورة المُنزَّل، فذلك يعني أن القالب يستخدم "
        "خطًا بلا نسخة عربية. غيّر خط القالب إلى IBM Plex Sans Arabic ثم أعد التنزيل.",
    ),
    (
        "adding-a-branch", "account", "published",
        "Adding a new branch to your account",
        "إضافة فرع جديد إلى حسابك",
        "A branch is an organisational unit, not a permission boundary. Adding one gives you a "
        "way to route tickets, filter reports and label customers by location; it does not by "
        "itself stop an agent in one branch from seeing another branch's tickets. Access is "
        "controlled by role.\n\n"
        "Only an administrator can add a branch. Open the admin back-office, choose *Branches* "
        "and then *Add branch*. Three fields are required: the English name, the Arabic name and "
        "a short code. The code is used in exports and report headings, so keep it lowercase and "
        "stable — changing it later breaks saved report filters that reference it.\n\n"
        "Once the branch exists, assign staff to it from the user record and customers to it "
        "from the customer record. Tickets inherit their branch from the customer at the moment "
        "they are created, so moving a customer between branches does not move their historical "
        "tickets. That is intentional: a report on last quarter should not change because of an "
        "administrative move made this week.\n\n"
        "A branch cannot be deleted while users or customers still point at it. Reassign them "
        "first, or leave the branch in place — an unused branch costs nothing and keeps the "
        "history readable.",
        "الفرع وحدة تنظيمية وليس حدًّا للصلاحيات. فإضافته تمنحك وسيلة لتوجيه التذاكر وتصفية "
        "التقارير وتصنيف العملاء حسب الموقع، لكنها لا تمنع بحد ذاتها موظفًا في فرع من الاطلاع "
        "على تذاكر فرع آخر، إذ يخضع الوصول لصلاحيات الدور.\n\n"
        "إضافة الفرع متاحة للمدير النظامي فقط. افتح لوحة الإدارة، ثم اختر «الفروع» ثم «إضافة "
        "فرع». وتُطلب ثلاثة حقول: الاسم بالإنجليزية، والاسم بالعربية، ورمز مختصر. ويُستخدم الرمز "
        "في ملفات التصدير وعناوين التقارير، لذا اجعله بحروف صغيرة وثابتًا، فتغييره لاحقًا يُعطّل "
        "عوامل التصفية المحفوظة التي تشير إليه.\n\n"
        "وبعد إنشاء الفرع، اربط به الموظفين من سجل المستخدم والعملاء من سجل العميل. وترث التذكرة "
        "فرعها من العميل لحظة إنشائها، لذا فإن نقل عميل بين الفروع لا ينقل تذاكره السابقة. وهذا "
        "سلوك مقصود، إذ لا يصح أن يتغيّر تقرير الربع الماضي بسبب نقل إداري جرى هذا الأسبوع.\n\n"
        "ولا يمكن حذف فرع ما دام مرتبطًا بمستخدمين أو عملاء. أعِد ربطهم أولًا، أو اترك الفرع "
        "كما هو، فالفرع غير المستخدم لا يكلّف شيئًا ويُبقي السجل التاريخي مفهومًا.",
    ),
    (
        "exporting-the-audit-log", "account", "published",
        "Exporting the audit log",
        "تصدير سجل التدقيق",
        "The audit log records who changed what and when. It is append-only — nobody, including "
        "an administrator, can edit or delete an entry. That is what makes it usable as "
        "evidence.\n\n"
        "To export it, open the admin back-office and choose *Audit log*. Narrow the list first "
        "using the filters on the right: action type, model, and a date range. Exporting an "
        "unfiltered log on a busy account produces a file large enough to be useless. Once the "
        "list shows what you want, use the export action at the top of the page; the file "
        "downloads as CSV in the order shown, newest first.\n\n"
        "Each row carries the actor, the action, the model and object affected, a JSON summary "
        "of what changed, and a timestamp in UTC. The changes column holds old and new values "
        "for every field that moved, which is usually what an auditor actually asks for.\n\n"
        "Two limits are worth knowing before you promise a report to anyone. Entries are written "
        "for model changes, not for read access — the log will not tell you who *looked* at a "
        "record. And exports are capped at 50,000 rows per file; beyond that, split the date "
        "range and export in parts.",
        "يسجّل سجل التدقيق مَن غيّر وماذا غيّر ومتى. وهو سجل إضافي فقط، فلا يستطيع أحد — بمن في "
        "ذلك المدير النظامي — تعديل أي قيد أو حذفه، وهذا تحديدًا ما يجعله صالحًا للاحتجاج به.\n\n"
        "لتصديره، افتح لوحة الإدارة واختر «سجل التدقيق». وضيّق القائمة أولًا باستخدام عوامل "
        "التصفية على الجانب: نوع الإجراء، والنموذج، والمدى الزمني. فتصدير سجل غير مُصفّى في حساب "
        "نشط ينتج ملفًا ضخمًا بلا فائدة. وحين تعرض القائمة ما تريد، استخدم إجراء التصدير أعلى "
        "الصفحة، فيُنزَّل الملف بصيغة CSV بالترتيب المعروض من الأحدث إلى الأقدم.\n\n"
        "يحمل كل سطر اسم المنفّذ، ونوع الإجراء، والنموذج والسجل المتأثر، وملخصًا بصيغة JSON لما "
        "تغيّر، وطابعًا زمنيًا بتوقيت UTC. ويحتوي عمود التغييرات على القيمة السابقة والقيمة "
        "الجديدة لكل حقل تغيّر، وهو ما يطلبه المدقّق عادةً.\n\n"
        "وثمة قيدان ينبغي معرفتهما قبل الالتزام بتقرير لأي جهة: تُكتب القيود عند تغيير البيانات "
        "لا عند الاطلاع عليها، فالسجل لا يخبرك مَن اطّلع على سجل معيّن. كما يقتصر التصدير على "
        "خمسين ألف سطر في الملف الواحد، وما زاد على ذلك يُقسَّم على مدَيات زمنية أصغر.",
    ),
    (
        "monthly-statement", "billing", "published",
        "Understanding your monthly statement",
        "قراءة كشف الحساب الشهري",
        "The monthly statement is a summary of movement on your account, not a demand for "
        "payment. Invoices are the demand; the statement tells you where they stand.\n\n"
        "Read it in three parts. The opening balance is what was outstanding at the start of the "
        "period. The movement section lists every invoice issued, every payment received and "
        "every credit note applied, in date order. The closing balance is the arithmetic result, "
        "and it should match the total of your unpaid invoices exactly.\n\n"
        "A common surprise is a payment that appears on the statement a few days after you made "
        "it. Bank transfers are matched to the account when the funds clear, not when they are "
        "sent, so a transfer made on the last day of the month usually lands on the following "
        "month's statement. This does not affect whether the invoice is treated as paid on "
        "time — the payment date on the invoice is the date you sent it.\n\n"
        "If the closing balance does not match your own records, the fastest route is a ticket "
        "under Invoices & Billing with the statement period and the figure you expected. Include "
        "the invoice numbers you believe are already settled; that is normally enough to find "
        "the discrepancy on the first pass.",
        "كشف الحساب الشهري ملخّص لحركة حسابك وليس مطالبة بالسداد. فالمطالبة هي الفاتورة، أما "
        "الكشف فيبيّن لك وضع تلك الفواتير.\n\n"
        "اقرأ الكشف على ثلاثة أجزاء. الرصيد الافتتاحي هو المبلغ المستحق في بداية الفترة. وقسم "
        "الحركة يسرد كل فاتورة صدرت، وكل دفعة وردت، وكل إشعار دائن طُبِّق، مرتبة بحسب التاريخ. "
        "أما الرصيد الختامي فهو حصيلة هذه الحركة، ويجب أن يطابق مجموع فواتيرك غير المسددة تمامًا."
        "\n\n"
        "ومن أكثر ما يثير الالتباس ظهور دفعة في الكشف بعد أيام من سدادها. فالحوالات البنكية "
        "تُطابَق مع الحساب عند وصول المبلغ فعليًا لا عند إرساله، ولذلك فإن حوالة أُرسلت في آخر يوم "
        "من الشهر تظهر عادةً في كشف الشهر التالي. ولا يؤثر ذلك على اعتبار الفاتورة مسددة في "
        "موعدها، لأن تاريخ السداد المعتمد على الفاتورة هو تاريخ إرسالك للمبلغ.\n\n"
        "وإذا لم يطابق الرصيد الختامي سجلاتك، فأسرع طريق هو رفع تذكرة تحت تصنيف «الفواتير "
        "والفوترة» مع ذكر فترة الكشف والمبلغ الذي تتوقعه، وإرفاق أرقام الفواتير التي تعتقد أنها "
        "مسددة، فذلك يكفي عادةً لتحديد الفارق من المراجعة الأولى.",
    ),
    (
        "reset-portal-password", "getting-started", "published",
        "Resetting your customer portal password",
        "إعادة تعيين كلمة مرور بوابة العملاء",
        "You can reset your own portal password without contacting support. On the portal login "
        "page, choose *Forgot password* and enter the email address your account is registered "
        "under. A reset link arrives within a minute or two and stays valid for one hour.\n\n"
        "If no email arrives, the cause is nearly always one of two things. Either the address "
        "you entered is not the one on the account — a personal address instead of the work "
        "address the account was created with — or the message is in a spam folder, which "
        "happens on first use before the sender is trusted.\n\n"
        "The reset link can only be used once. Opening it, then opening it again from the email "
        "later, produces an invalid-link message; request a new one instead. A link older than "
        "an hour behaves the same way.\n\n"
        "Portal accounts are separate from agent accounts. If you work for us and also have a "
        "customer login for testing, resetting one does not affect the other.",
        "يمكنك إعادة تعيين كلمة مرور البوابة بنفسك دون الحاجة إلى مراسلة الدعم. من صفحة تسجيل "
        "الدخول إلى البوابة، اختر «نسيت كلمة المرور» وأدخل البريد الإلكتروني المسجَّل به حسابك، "
        "فيصلك رابط إعادة التعيين خلال دقيقة أو دقيقتين ويظل صالحًا لمدة ساعة واحدة.\n\n"
        "وإذا لم تصلك الرسالة، فالسبب في الغالب أحد أمرين: إمّا أن البريد الذي أدخلته ليس البريد "
        "المسجَّل في الحساب — كأن يكون بريدًا شخصيًا بدل بريد العمل الذي أُنشئ به الحساب — وإمّا "
        "أن الرسالة وصلت إلى مجلد البريد غير المرغوب فيه، وهو ما يحدث عند أول استخدام قبل أن "
        "يصبح المُرسِل موثوقًا.\n\n"
        "ولا يصلح رابط إعادة التعيين إلا مرة واحدة. ففتحه ثم العودة إليه من البريد لاحقًا يُظهر "
        "رسالة «رابط غير صالح»، والحل هو طلب رابط جديد. وينطبق السلوك نفسه على أي رابط مضى على "
        "إصداره أكثر من ساعة.\n\n"
        "وحسابات البوابة منفصلة عن حسابات الموظفين. فإذا كنت تعمل لدينا ولديك أيضًا حساب عميل "
        "لأغراض الاختبار، فإن إعادة تعيين أحدهما لا تؤثر على الآخر.",
    ),
    (
        "whatsapp-business-setup", "technical", "published",
        "Connecting WhatsApp Business to your support inbox",
        "ربط واتساب للأعمال بصندوق الدعم",
        "WhatsApp arrives in the support inbox as a channel, alongside email, SMS, live chat and "
        "the portal. A ticket opened over WhatsApp carries a WhatsApp badge and every reply on "
        "it goes back out the same way, so the customer never has to change app mid-"
        "conversation.\n\n"
        "Connecting it needs three things on your side: a WhatsApp Business account, a phone "
        "number that is not already registered to the consumer WhatsApp app, and a verified "
        "business profile. The number is the part that most often causes a delay — if it is "
        "currently in use on a handset, it must be released before it can be registered, and "
        "the release is not instant.\n\n"
        "Once connected, note the 24-hour rule. Outside a 24-hour window from the customer's "
        "last message, WhatsApp only permits pre-approved message templates, not free text. In "
        "practice this means a reply to a two-day-old conversation may need to go out as a "
        "template or through another channel. The composer tells you which case you are in "
        "before you send.\n\n"
        "Group chats are not supported, and media larger than 16 MB is rejected by WhatsApp "
        "itself rather than by us. For large files, ask the customer to attach them to the "
        "ticket through the portal.",
        "يصل واتساب إلى صندوق الدعم بوصفه قناة، إلى جانب البريد الإلكتروني والرسائل النصية "
        "والدردشة المباشرة والبوابة. وتحمل التذكرة المفتوحة عبر واتساب شارة واتساب، وتخرج كل "
        "الردود عليها من القناة نفسها، فلا يضطر العميل إلى تغيير التطبيق في منتصف المحادثة.\n\n"
        "ويتطلب الربط ثلاثة أمور من جهتك: حساب واتساب للأعمال، ورقم هاتف غير مسجَّل مسبقًا على "
        "تطبيق واتساب الشخصي، وملف تجاري موثَّق. والرقم هو أكثر ما يسبّب التأخير، فإن كان مستخدمًا "
        "على جهاز حاليًا وجب تحريره قبل تسجيله، والتحرير لا يتم فورًا.\n\n"
        "وبعد إتمام الربط، انتبه إلى قاعدة الأربع والعشرين ساعة: فخارج نافذة أربع وعشرين ساعة من "
        "آخر رسالة للعميل، لا يسمح واتساب إلا بقوالب رسائل معتمدة مسبقًا لا بنص حر. ويعني ذلك "
        "عمليًا أن الرد على محادثة عمرها يومان قد يحتاج إلى إرساله كقالب أو عبر قناة أخرى، "
        "ويبيّن لك المحرّر أي الحالتين أنت فيها قبل الإرسال.\n\n"
        "ولا تُدعم المحادثات الجماعية، كما يرفض واتساب نفسه — لا نظامنا — الوسائط التي يتجاوز "
        "حجمها ستة عشر ميغابايت. وللملفات الكبيرة، اطلب من العميل إرفاقها بالتذكرة عبر البوابة.",
    ),
    (
        "how-sla-is-measured", "getting-started", "published",
        "How SLA response and resolution times are measured",
        "كيف تُحتسب أزمنة الاستجابة والحل في اتفاقية مستوى الخدمة",
        "Every ticket carries two clocks. The response clock runs from the moment the ticket is "
        "created until an agent sends the first public reply. The resolution clock runs from the "
        "same starting point until the ticket is marked resolved. They run in parallel, not one "
        "after the other.\n\n"
        "How long each clock is allowed to run depends on the SLA policy that matched the "
        "ticket, and a policy is chosen from two things: the customer's tier and the ticket's "
        "priority. An urgent ticket from an enterprise customer matches Enterprise-P1 — thirty "
        "minutes to respond, eight hours to resolve. The same ticket from a standard customer "
        "matches Standard-P1 and is given considerably longer.\n\n"
        "The due timestamps are written once, when the ticket is created, and stored on the "
        "ticket. They do not move afterwards. Changing a ticket's priority later does not "
        "silently rewrite history — the original commitment stands, which is what makes the "
        "compliance report trustworthy.\n\n"
        "At the escalation threshold on the policy, usually ninety per cent of the resolution "
        "window, the ticket is flagged for escalation and appears in the manager's Breaching "
        "view. Breach itself is not a failure state in the system: the ticket stays open, the "
        "clock keeps a record of how far past due it went, and the compliance report counts it.",
        "تحمل كل تذكرة ساعتين. تبدأ ساعة الاستجابة من لحظة إنشاء التذكرة وتتوقف عند إرسال الموظف "
        "أول ردّ علني. وتبدأ ساعة الحل من النقطة نفسها وتتوقف عند وضع التذكرة في حالة «تم الحل». "
        "وتعمل الساعتان بالتوازي لا بالتتابع.\n\n"
        "أما المدة المسموح بها لكل ساعة فتحدّدها سياسة مستوى الخدمة المطابقة للتذكرة، وتُختار "
        "السياسة بناءً على أمرين: فئة العميل وأولوية التذكرة. فالتذكرة العاجلة من عميل من فئة "
        "المؤسسات تطابق سياسة Enterprise-P1، أي ثلاثون دقيقة للاستجابة وثماني ساعات للحل. "
        "والتذكرة نفسها من عميل قياسي تطابق Standard-P1 وتُمنح مدة أطول بكثير.\n\n"
        "وتُكتب مواعيد الاستحقاق مرة واحدة عند إنشاء التذكرة وتُخزَّن عليها، ولا تتغيّر بعد ذلك. "
        "فتغيير أولوية التذكرة لاحقًا لا يعيد كتابة التاريخ في صمت، بل يبقى الالتزام الأصلي "
        "قائمًا، وهذا ما يجعل تقرير الالتزام جديرًا بالثقة.\n\n"
        "وعند بلوغ حدّ التصعيد المحدَّد في السياسة، وهو تسعون بالمئة من مدة الحل عادةً، تُوسم "
        "التذكرة للتصعيد وتظهر في عرض «قاربت على التجاوز» لدى المدير. وتجاوز المدة ليس حالة فشل "
        "في النظام: تبقى التذكرة مفتوحة، وتسجّل الساعة مقدار التجاوز، ويحتسبه تقرير الالتزام.",
    ),
    (
        "ticket-priorities-explained", "getting-started", "published",
        "Ticket priorities explained",
        "",
        "Priority answers one question: how much of the business is stopped? It is not a measure "
        "of how annoyed the customer is, and it is not a queue-jumping favour.\n\n"
        "*Urgent* means a business-critical function is unavailable and there is no workaround — "
        "payments failing for everyone, the portal down, data visibly wrong in a way that "
        "affects decisions. *High* means a significant function is degraded, or a critical one "
        "is broken but has a workaround. *Normal* is the default: something is wrong, work "
        "continues. *Low* covers requests with no time pressure — a cosmetic issue, a question, "
        "a feature request.\n\n"
        "Priority is set by the agent, not by the customer, and it can be changed at any point "
        "as understanding improves. Raising it does not retroactively change the SLA due "
        "timestamps already written on the ticket; those were set from the priority at "
        "creation.\n\n"
        "If you are unsure between two levels, pick the lower one and say why in an internal "
        "note. An escalation with a stated reason is easy to justify later; a queue where "
        "everything is urgent is not.",
        # body_ar is deliberately empty. Story 08's editor shows a per-language
        # completeness indicator and warns before publishing a single-language
        # article — that flow needs a half-translated article to exist.
        "",
    ),
    (
        "portal-attachments-limits", "technical", "draft",
        "Attachment size and file type limits",
        "حدود حجم المرفقات وأنواع الملفات",
        "Attachments are capped at 20 MB per file and 10 files per message. The limit is applied "
        "in the browser before the upload starts, so an oversized file is rejected immediately "
        "rather than after a long wait.\n\n"
        "Executable files are refused outright — .exe, .bat, .sh, .msi and archives containing "
        "them. This is not configurable per account. For anything that would normally be sent as "
        "an archive, use a shared link and paste it in the reply instead.\n\n"
        "Screenshots pasted directly into the composer are uploaded as PNG and count towards the "
        "same limits. Large screenshots of a full desktop are frequently over the file limit; "
        "cropping to the relevant window usually brings them well under it.",
        "يقتصر حجم المرفق الواحد على عشرين ميغابايت، وعدد الملفات على عشرة في الرسالة الواحدة. "
        "ويُطبَّق هذا الحدّ في المتصفح قبل بدء الرفع، فيُرفض الملف الكبير فورًا بدل الانتظار "
        "الطويل ثم الفشل.\n\n"
        "وتُرفض الملفات التنفيذية رفضًا تامًّا، ومنها ‎.exe و‎.bat و‎.sh و‎.msi وملفات الأرشيف التي "
        "تحتويها، وهذا الإعداد غير قابل للتعديل على مستوى الحساب. أما ما يُرسَل عادةً في ملف "
        "مضغوط، فاستخدم له رابط مشاركة والصقه في الرد.\n\n"
        "وتُرفع لقطات الشاشة الملصوقة مباشرة في محرّر الرد بصيغة PNG وتُحتسب ضمن الحدود نفسها. "
        "وكثيرًا ما تتجاوز لقطات سطح المكتب الكامل حدّ الحجم، ويكفي عادةً قصّها على النافذة "
        "المعنية لتنزل دونه بكثير.",
    ),
]

# --------------------------------------------------------------------------
# Ticket subjects — (category slug, subject_en, description)
# --------------------------------------------------------------------------

TICKET_SEEDS = [
    ("billing-invoice", "Invoice INV-2291 shows last month's usage",
     "The invoice we received this morning repeats the line items from the previous period. "
     "The totals do not match the usage report in the portal."),
    ("billing-invoice", "VAT number missing from the PDF invoice",
     "Our finance team cannot file the invoice without the seller VAT number printed on it."),
    ("billing-invoice", "Request a copy of the March statement",
     "We need the March statement re-sent to the accounts inbox — the original went to a "
     "colleague who has since left."),
    ("payments", "Bank transfer sent but account still shows unpaid",
     "Transfer was made on Sunday from Al Rajhi. Reference attached. The portal still shows the "
     "invoice as outstanding."),
    ("payments", "Refund for the duplicate October charge",
     "We were charged twice in October. One of the two needs to be refunded to the original card."),
    ("payments", "Payment link expired before we could use it",
     "The link in the last email says it is no longer valid. Please send a new one."),
    ("account-access", "Cannot log in to the portal after password reset",
     "Reset the password yesterday. The new password is rejected with 'invalid credentials'."),
    ("account-access", "Add two new users to our account",
     "Two new staff joined the finance team and need portal access with read-only permissions."),
    ("account-access", "Remove access for a departed employee",
     "Please revoke portal access for our former procurement officer with immediate effect."),
    ("technical-fault", "Portal returns a 500 error when opening any ticket",
     "Since this morning, clicking any ticket in the list shows a server error page. Reproduced "
     "on Chrome and Safari, two different machines."),
    ("technical-fault", "Exported CSV is empty for the last 30 days",
     "The export downloads but contains only the header row, even though the list on screen "
     "shows results."),
    ("technical-fault", "Arabic text renders as disconnected letters in the PDF",
     "The downloaded invoice shows Arabic characters unjoined and right-to-left order broken."),
    ("technical-fault", "Search returns no results for Arabic keywords",
     "Searching in English works. The same search in Arabic returns nothing at all."),
    ("notifications", "SMS notifications arriving four hours late",
     "Ticket update notifications by SMS are consistently late by several hours. Email arrives "
     "immediately."),
    ("notifications", "Stop duplicate email notifications",
     "Every ticket update sends two identical emails to the same address."),
    ("notifications", "Change the notification address for billing alerts",
     "Billing alerts should go to accounts@ rather than to the personal address currently set."),
    ("feature-request", "Add a monthly SLA compliance export",
     "It would help to export the SLA compliance figure per month rather than reading it off "
     "the dashboard."),
    ("feature-request", "Allow filtering the queue by branch",
     "We run three branches and would like the queue filtered to one at a time."),
    ("onboarding", "Set up the Arabic invoice template for our account",
     "We need invoices issued in Arabic from next cycle onwards."),
    ("onboarding", "Connect our WhatsApp Business number",
     "We would like customer replies to arrive over WhatsApp rather than email."),
    ("onboarding", "Import our existing customer list",
     "We have around 400 customer records in a spreadsheet to bring across."),
    ("billing-invoice", "Credit note not reflected on the statement",
     "A credit note was issued last week but the closing balance has not changed."),
    ("technical-fault", "Attachments fail to upload above 5 MB",
     "The upload bar reaches the end and then shows a generic failure message."),
    ("notifications", "Push notifications stopped after the app update",
     "Nothing has arrived on any device since the update on Tuesday."),
    ("account-access", "Two-factor code never arrives",
     "The login page asks for a code but no SMS is received on the registered number."),
]

TICKET_SUBJECTS_AR_HINT = (
    "مرفق ملخص بالعربية من العميل: تم توضيح المشكلة عبر الهاتف ثم تسجيلها هنا للمتابعة."
)

# --------------------------------------------------------------------------
# Conversation fragments
# --------------------------------------------------------------------------

CUSTOMER_REPLIES = [
    "Thanks for the quick response. I have attached the reference we discussed on the call.",
    "Still seeing the same behaviour this morning — nothing has changed on our side.",
    "That worked, thank you. Please keep the ticket open until the end of the week in case it "
    "comes back.",
    "Could you confirm roughly when this will be looked at? Our finance close is on Thursday.",
    "شكرًا على المتابعة. جرّبنا الخطوات المذكورة ولم تتغيّر النتيجة حتى الآن.",
    "تم الأمر بنجاح، شكرًا لكم. نرجو إبقاء التذكرة مفتوحة حتى نهاية الأسبوع للاطمئنان.",
    "هل يمكن تزويدنا بموعد تقريبي للمعالجة؟ لدينا إقفال مالي يوم الخميس.",
]

AGENT_REPLIES = [
    "Thank you for reporting this. I can reproduce it on my side and have raised it with the "
    "platform team. I will update you as soon as I have a fix window.",
    "I have applied the change to your account. Could you check on your side and confirm it "
    "looks right?",
    "Looking at the record, the payment did reach us on Sunday but was matched to a different "
    "invoice. I have re-allocated it and the balance is now correct.",
    "I need one more detail before I can move this forward: the exact time you saw the error, "
    "and whether it affects every user or just one.",
    "وصلني طلبك وأعمل على متابعته الآن. سأوافيك بتحديث خلال ساعتَي عمل.",
    "تم تنفيذ التعديل على حسابك، وأرجو التأكد من ظهوره بشكل صحيح لديك.",
    "راجعت السجل ووجدت أن الدفعة وصلت فعلًا لكنها طوبقت مع فاتورة أخرى. أعدت توجيهها والرصيد "
    "الآن صحيح.",
]

INTERNAL_NOTES = [
    "Checked the logs — the 500 is coming from the export serializer, not the ticket view. "
    "Passing to the platform team rather than fixing in support.",
    "Customer is on Enterprise-P1. Watch the resolution clock, we are past halfway.",
    "Third ticket from this account this week on the same theme. Worth flagging to the account "
    "manager before the renewal call.",
    "Payment confirmed against bank statement line 44. Safe to release the account.",
    "Duplicate of an earlier ticket from the same contact. Keeping this one as the live thread "
    "and closing the other.",
    "Needs the billing team — I do not have permission to issue a credit note on this account.",
]

ASSIGNMENT_REASONS = [
    "auto-assigned by rule R-12",
    "auto-assigned by rule R-04 (round-robin, technical)",
    "manually assigned by manager@demo",
    "auto-assigned by rule R-07 (branch match)",
    "reassigned after escalation to Tier 3",
    "picked up from the unassigned queue",
]

CSAT_COMMENTS = [
    "Fast and clear. The agent explained exactly what had gone wrong.",
    "Sorted in under an hour. No complaints.",
    "Good outcome, though it took a few days to get moving.",
    "خدمة ممتازة وسرعة في الرد. شكرًا لكم.",
    "تمت المعالجة بشكل جيد، مع بعض التأخير في البداية.",
    "",
    "",
]
