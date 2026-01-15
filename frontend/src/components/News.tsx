import "./News.css";

export function News() {
  return (
    <div className="news">
      <h1 className="news-title">News</h1>
      <p>
        1/14/2026
        <br />
        This is just here to show how the news entries will look. Will be
        removed later.
      </p>
      <p>
        1/14/2026
        <br />
        Still in pre-release stages! Check{" "}
        <a href="https://github.com/UltraDagon/word-scorer-game" target="blank">
          github.com/UltraDagon/word-scorer-game
        </a>{" "}
        for info on the latest changes!
      </p>
    </div>
  );
}
