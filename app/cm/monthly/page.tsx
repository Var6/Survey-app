import { PageTitle } from "@/components/ui";
import MyMonthlyReportsClient from "@/components/MyMonthlyReportsClient";

export const metadata = { title: "मेरी मासिक रिपोर्ट · My monthly reports" };

export default function CmMonthlyPage() {
  return (
    <div>
      <PageTitle
        title="मेरी मासिक रिपोर्ट"
        subtitle="हर महीने की रिपोर्ट यहाँ है — नई शुरू करें या पुरानी देखें"
        back={{ href: "/cm", label: "Home" }}
      />
      <MyMonthlyReportsClient basePath="/cm/monthly" variantKey="cm" />
    </div>
  );
}
