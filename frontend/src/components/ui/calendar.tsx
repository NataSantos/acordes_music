import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={ptBR}
      className={cn("p-2", className)}
      classNames={{
        root: "w-full",
        months: "flex flex-col gap-2",
        month: "space-y-2 w-full",
        month_grid: "w-full border-collapse",
        month_caption: "flex justify-center pt-1 relative items-center h-7",
        caption_label: "text-xs font-medium",
        nav: "space-x-1 flex items-center",
        button_previous: cn(buttonVariants({ variant: "outline" }), "absolute left-1 size-6 bg-transparent p-0 opacity-50 hover:opacity-100"),
        button_next: cn(buttonVariants({ variant: "outline" }), "absolute right-1 size-6 bg-transparent p-0 opacity-50 hover:opacity-100"),
        weeks: "w-full",
        weekdays: "flex w-full",
        weekday: "text-muted-foreground w-7 font-normal text-[0.7rem] flex-1",
        week: "flex w-full",
        day: cn(buttonVariants({ variant: "ghost" }), "size-7 w-full p-0 font-normal aria-selected:opacity-100 text-xs"),
        day_button: cn(buttonVariants({ variant: "ghost" }), "size-7 w-full p-0 font-normal aria-selected:opacity-100 text-xs"),
        today: "bg-accent text-accent-foreground",
        outside: "text-muted-foreground opacity-50 aria-selected:bg-accent/50",
        disabled: "text-muted-foreground opacity-50",
        selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        hidden: "invisible",
        ...classNames,
      } as any}
      {...props}
    />
  );
}

export { Calendar };
