import { Navbar } from "@/Components/Navbar";
import { useOutlet } from "react-router-dom";

export default function DefaultLayout() {
    const outlet = useOutlet();
    return (
        <>
            <Navbar />
            {outlet}
        </>
    );
}
