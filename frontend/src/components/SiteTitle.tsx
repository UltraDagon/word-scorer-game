import "./SiteTitle.css";

export function SiteTitle() {
  const title = "WORD SCORER GAME".split("");
  return (
    <div className="title">
      {title.map((letter, index) =>
        letter !== " " ? (
          <p key={index}>{letter}</p>
        ) : (
          <span className="break" key={index} />
        )
      )}
    </div>
  );
}
