import DefaultLayout from "@/Components/Layout/default";
import { RouterProvider, createBrowserRouter } from "react-router-dom";

const router = createBrowserRouter([
    {
        path: "*",
        Component: DefaultLayout,
    },
]);

export default function App() {
    return <RouterProvider router={router} />;
}
