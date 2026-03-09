import { Check } from "lucide-react";

const steps = [
  "Đã đặt đơn",
  "Shop xác nhận",
  "Đang gom hàng về kho mGift",
  "Đang đóng gói",
  "Đang giao",
  "Đã giao",
];

interface OrderStepperProps {
  currentStep: number;
}

export function OrderStepper({ currentStep }: OrderStepperProps) {
  return (
    <div className="space-y-0">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        return (
          <div key={step} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                  isCompleted
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCurrent
                    ? "border-primary text-primary"
                    : "border-muted-foreground/30 text-muted-foreground/30"
                }`}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-8 w-0.5 ${
                    isCompleted ? "bg-primary" : "bg-muted-foreground/20"
                  }`}
                />
              )}
            </div>
            <div className="pb-8">
              <p
                className={`text-sm font-medium ${
                  isCompleted || isCurrent
                    ? "text-foreground"
                    : "text-muted-foreground/50"
                }`}
              >
                {step}
              </p>
              {isCurrent && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Đang xử lý...
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
