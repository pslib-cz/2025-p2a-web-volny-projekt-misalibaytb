import { HamburgerMenu } from "@/Components/ui/Hamburger";
import { Link } from "react-router-dom";

export function Navbar() {
    return (
        <nav id="nav">
            <div className="container">
                <div className="head">
                    <Link to="/">misaliba</Link>
                    <HamburgerMenu
                        onClick={(event) => {
                            event.stopPropagation();

                            const nav = document.getElementById("nav");
                            nav?.classList.toggle("active");

                            const closeNav = () => {
                                nav?.classList.remove("active");
                                document.removeEventListener("click", closeNav);
                            };

                            setTimeout(() => {
                                document.addEventListener("click", closeNav);
                            }, 0);
                        }}
                    />
                </div>
                <div className="links">
                    <Link to="/">
                        <i className="far fa-user" />
                        About
                    </Link>
                    <Link to="/skills">
                        <i className="fas fa-bolt" />
                        Skills
                    </Link>
                    <Link to="/projects">
                        <i className="fas fa-code" />
                        Projects
                    </Link>
                    <Link to="/contact">
                        <i className="far fa-envelope" />
                        Contact
                    </Link>
                </div>
            </div>
        </nav>
    );
}
