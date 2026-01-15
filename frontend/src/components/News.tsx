import "./News.css";

export function News() {
  return (
    <div className="news">
      <h1 className="news-title">News</h1>
      <p>
        1/15/2026
        <br />
        Ran another playtest! Steps left before beta release: create a
        bug/suggestion form, change website address, websocket security checks
        (especially for score).
        <br />
        Features and bugs:
        <br />
        - Added the feature for the 2nd earliest player in a lobby to be able to
        kick the owner if the owner disconnects.
        <br />- Bug: Tiles placed on the far left column would split in to two
        words. Ex: COW --{">"} COW & OW.
        <br />
        - Bug: Claiming a user after a disconnect would lead to a shift in the
        user order, possibly leading to someone's turn being skipped.
        <br />- Bug: The "Kick User" button would not appear to the owner of the
        lobby when it was supposed to.
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
