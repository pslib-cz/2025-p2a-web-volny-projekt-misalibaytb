import { HamburgerMenu } from "@/Components/ui/Hamburger";
import { Link } from "react-router-dom";

export function Navbar() {
    return (
        <nav id="nav">
            <div className="container">
                <div className="group">
                    <Link to="/">misaliba</Link>
                    <HamburgerMenu
                        onClick={() => {
                            document
                                .getElementById("nav")
                                ?.classList.toggle("active");
                        }}
                    />
                </div>
            </div>
        </nav>
    );
}
