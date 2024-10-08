export const Collapse = () => {
    return (
        <div tabIndex={0} className="collapse collapse-arrow border-base-300 bg-base-200 border">
            <input type="checkbox" className="peer" />
            <div
                className="collapse-title text-xl font-medium">
                Click me to show/hide content
            </div>
            <div
                className="collapse-content">
                <p>hello</p>
            </div>
        </div>
    )
}
export default Collapse