import '../styles/TopBar.css';

type TopBarProps = {
  selectedMap: number;
  onSelectMap: (mapNumber: number) => void;
};

const TopBar: React.FC<TopBarProps> = ({ selectedMap, onSelectMap }) => {
  return (
    <div className="top-bar">
      {Array.from({ length: 15 }, (_, index) => {
        const mapNumber = index + 1;

        return (
          <button
            key={mapNumber}
            className={`map-button ${selectedMap === mapNumber ? 'selected' : ''}`}
            onClick={() => onSelectMap(mapNumber)}
            type="button"
          >
            Map {mapNumber}
          </button>
        );
      })}
    </div>
  );
};

export default TopBar;
