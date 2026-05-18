interface Props {
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => unknown;
}
export function HamburgerMenu(props: Props) {
    return (
        <button className="hamburger" onClick={props.onClick}>
            <span />
            <span />
            <span />
        </button>
    );
}
