import { PageTitle } from "@/components/ui";
import CmCasesClient from "@/components/CmCasesClient";

export const metadata = { title: "My cases" };

export default function CmCasesPage() {
  return (
    <div>
      <PageTitle title="मेरे केस · My cases" subtitle="फॉलो-अप दर्ज करें और बंद करने का अनुरोध भेजें" />
      <CmCasesClient />
    </div>
  );
}
