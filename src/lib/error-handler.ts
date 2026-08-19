import { z } from "zod";

export const FIELD_MAPPING: Record<string, string> = {
  phone: "شماره تلفن",
  mobile: "شماره موبایل",
  email: "ایمیل",
  firstName: "نام",
  lastName: "نام خانوادگی",
  name: "نام",
  province: "استان",
  city: "شهر",
  address: "آدرس",
  line: "آدرس",
  postalCode: "کد پستی",
  nationalCode: "کد ملی",
  amount: "مبلغ",
  rating: "امتیاز",
  body: "متن",
  authorName: "نام نویسنده",
  qty: "تعداد",
  productId: "محصول",
  shipping: "شیوه ارسال",
  payment: "درگاه پرداخت",
  discountCode: "کد تخفیف",
  note: "یادداشت",
  fullName: "نام و نام خانوادگی",
};

export const PAYMENT_ERROR_MAPPING: Record<string, string> = {
  PAYMENT_REQUEST_FAILED: "ایجاد درخواست پرداخت انجام نشد. لطفاً دوباره تلاش کنید.",
  PAYMENT_VERIFY_FAILED: "تأیید پرداخت انجام نشد.",
  PAYMENT_CANCELED: "پرداخت توسط شما لغو شد یا ناموفق بود.",
  PAYMENT_ALREADY_PAID: "این سفارش قبلاً پرداخت شده است.",
  PAYMENT_REQUEST_CONFLICT: "درخواست پرداخت دیگری برای این سفارش ثبت شده است. وضعیت سفارش را دوباره بررسی کنید.",
  PAYMENT_CALLBACK_NOT_CONFIGURED: "آدرس بازگشت درگاه روی سرور تنظیم نشده است.",
  PAYMENT_ORDER_NOT_FOUND: "سفارش مرتبط با پرداخت پیدا نشد.",
  PAYMENT_AMOUNT_MISMATCH: "مبلغ پرداخت با مبلغ سفارش مطابقت ندارد.",
  PAYMENT_EXPIRED: "زمان پرداخت به پایان رسیده است.",
  ZIBAL_UNAVAILABLE: "در حال حاضر ارتباط با درگاه پرداخت برقرار نشد. لطفاً کمی بعد دوباره تلاش کنید.",
  ZIBAL_INVALID_MERCHANT: "تنظیمات درگاه پرداخت صحیح نیست. لطفاً با پشتیبانی تماس بگیرید.",
  PAYMENT_UNKNOWN_ERROR: "در پرداخت مشکلی پیش آمد. لطفاً دوباره تلاش کنید.",

  // Zibal Specific Status Codes (Request & Verify)
  "ZIBAL_ERROR_100": "تراکنش با موفقیت انجام شده و تأیید گردید.",
  "ZIBAL_ERROR_102": "کد پذیرنده (merchant) نامعتبر است یا پیدا نشد.",
  "ZIBAL_ERROR_103": "درگاه غیرفعال است.",
  "ZIBAL_ERROR_104": "کد پذیرنده نامعتبر است.",
  "ZIBAL_ERROR_105": "مبلغ تراکنش باید حداقل ۱,۰۰۰ ریال باشد.",
  "ZIBAL_ERROR_106": "آدرس بازگشت (callbackUrl) نامعتبر است.",
  "ZIBAL_ERROR_113": "تراکنش توسط مالک کارت لغو شده است.",
  "ZIBAL_ERROR_201": "تراکنش قبلاً تأیید شده است.",
  "ZIBAL_ERROR_202": "تراکنش ناموفق است یا لغو شده است.",
  "ZIBAL_ERROR_203": "کد پیگیری (trackId) نامعتبر است.",
  "ZIBAL_ERROR_5": "خطای داخلی در سیستم درگاه رخ داده است.",
  "ZIBAL_ERROR_6": "سیستم بانکی در حال حاضر پاسخگو نیست.",
  "ZIBAL_ERROR_7": "تراکنش توسط بانک لغو شده است.",
};

export interface AppError {
  success: false;
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
  requestId?: string;
  developerMessage?: string;
}

export function isAppError(err: any): err is AppError {
  return err && typeof err === "object" && err.success === false && "error" in err;
}

export function formatZodError(error: z.ZodError): { message: string; fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  
  error.issues.forEach((issue) => {
    const path = issue.path.map(String);
    const lastPath = path[path.length - 1];
    const fieldName = FIELD_MAPPING[lastPath] || lastPath;
    
    let message = "";
    
    switch (issue.code) {
      case "invalid_type":
        message = `لطفاً ${fieldName} را به شکل صحیح وارد کنید.`;
        break;
      case "too_small":
        if (issue.type === "string") {
          message = issue.minimum === 1 
            ? `لطفاً ${fieldName} را وارد کنید.` 
            : `${fieldName} باید حداقل ${issue.minimum} کاراکتر باشد.`;
        } else {
          message = `${fieldName} باید حداقل ${issue.minimum} باشد.`;
        }
        break;
      case "too_big":
        message = `مقدار واردشده برای ${fieldName} بیش از حد مجاز است.`;
        break;
      case "invalid_string":
        if (issue.validation === "email") {
          message = "لطفاً یک ایمیل معتبر وارد کنید.";
        } else {
          message = `فرمت ${fieldName} صحیح نیست.`;
        }
        break;
      case "invalid_enum_value":
        message = `گزینه انتخاب‌شده برای ${fieldName} معتبر نیست.`;
        break;
      default:
        message = issue.message;
    }
    
    // Check for custom error message in schema (min(6, "message"))
    if (issue.message && issue.message !== "Required" && !issue.message.includes("String must contain")) {
      message = issue.message;
    }

    fields[path.join(".")] = message;
  });

  const firstError = Object.values(fields)[0];
  return {
    message: firstError || "اطلاعات واردشده صحیح نیست.",
    fields,
  };
}

export function normalizeError(error: any): AppError {
  const requestId = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  // Already normalized
  if (isAppError(error)) {
    return { ...error, requestId: error.requestId || requestId };
  }

  // Handle serverFn error objects (from @tanstack/react-start)
  if (error && typeof error === "object" && "error" in error && error.success === false) {
    const serverErr = error.error;
    return {
      success: false,
      error: {
        code: serverErr.code || "UNKNOWN_ERROR",
        message: serverErr.message || "خطایی رخ داد.",
        fields: serverErr.fields,
      },
      requestId: error.requestId || requestId,
    };
  }

  // Zod Error
  if (error instanceof z.ZodError) {
    const { message, fields } = formatZodError(error);
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message,
        fields,
      },
      requestId,
    };
  }

  // Authentication/Authorization
  const errorMsg = error?.message || String(error);
  if (errorMsg.includes("Unauthorized") || errorMsg.includes("دسترسی غیرمجاز")) {
    return {
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "برای انجام این عملیات باید وارد حساب کاربری خود شوید.",
      },
      requestId,
    };
  }

  // Database / Specific business errors
  if (errorMsg.includes("duplicate key")) {
    return {
      success: false,
      error: {
        code: "CONFLICT",
        message: "این مورد قبلاً ثبت شده است.",
      },
      requestId,
    };
  }

  // Payment errors (Zibal/Zarinpal mapping)
  if (PAYMENT_ERROR_MAPPING[errorMsg]) {
    return {
      success: false,
      error: {
        code: errorMsg,
        message: PAYMENT_ERROR_MAPPING[errorMsg],
      },
      requestId,
    };
  }

  // Handle prefix ZIBAL_ERROR_ mapping for any potential code not explicitly in mapping
  if (errorMsg.startsWith("ZIBAL_ERROR_")) {
    return {
      success: false,
      error: {
        code: errorMsg,
        message: "در حال حاضر امکان برقراری ارتباط با درگاه پرداخت وجود ندارد. لطفاً دوباره تلاش کنید.",
      },
      requestId,
    };
  }

  // Generic Fallback
  return {
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "متأسفانه مشکلی پیش آمده. لطفاً دوباره تلاش کنید.",
    },
    requestId,
    developerMessage: errorMsg,
  };
}
