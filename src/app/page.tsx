import snapshot from "../../public/data/dashboard.json";
import { Dashboard } from "../components/dashboard";
import { dashboardSchema } from "../types/dashboard";
const Page = () => <Dashboard initialData={dashboardSchema.parse(snapshot)} />;
export default Page;
