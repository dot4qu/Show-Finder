import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import ReactList from 'react-list-select';
import './SpotifySearch.css';

class SpotifySearch extends Component {
  baseState = {
    userName: null,
    headerText: 'Show Finder',
    playlists: [],
    playlistNamesById: {},
    allArtists: [],
    shows: [],
    showingForm: true,
    showingArtists: false,
    showingPlaylists: false,
    showingShows: false,
    showSpinner: false,
    locations: [],
    selectedLocation: null
  }

  state = {};

  locations = [
     { value: 'san francisco', displayName: 'San Francisco' },
     { value: 'los angeles', displayName: 'Los Angeles' },
     { value: 'washington', displayName: 'Washington DC' },
     { value: 'new york', displayName: 'New York' },
     { value: 'chicago', displayName: 'Chicago' },
     { value: 'houston', displayName: 'Houston' },
     { value: 'philadelphia', displayName: 'Philadelphia' }
    ];

  async instrumentCall(url, options) {
    let res;
    try {
      res = await fetch(url, options);
    } catch (e) {
      console.log(e);
      throw new Error(e);
    }

    if (res.status >= 400) {
      console.log(`ERROR contacting ${url} with options:`);
      console.log(options);
      console.log('Reponse: ');
      console.log(res);
      // throw new Error(res);
    }

    return res;
  }

  constructor(props) {
    super(props);

    // Use refs instead up updating state variables because for some reason
    // any call to `setState` from within the component's onChange causes all
    // the styling and selectedItems logic to get completely borked
    this.playlistListRef = React.createRef();
    this.artistListRef = React.createRef();

    this.state = this.baseState;
  }

  componentDidMount() {
    this.setState({ locations: this.locations });
  }

  resetState(overrides) {
    console.log(this.baseState);
    let newState = {...this.baseState, ...overrides };
    console.log(newState);
    this.setState(newState);
  }

  newSearch = () => {
    this.resetState({ userName: this.state.userName, locations: this.locations, selectedLocation: this.state.selectedLocation });
  }

  getPlaylists = async e => {
    e.preventDefault();
    if (this.state.selectedLocation == null || this.state.userName == null || this.state.userName === undefined || this.state.userName === '') {
      alert('You must enter a username and location');
      return;
    }

    let postOptions = {
      method: 'POST',
      headers: {
        'Content-type': 'application/json'
      },
      body: JSON.stringify({ username: this.state.userName })
    };

    this.setState({ showSpinner: true, showingForm: false, headerText: 'Fetching playlists...' });
    let res = await this.instrumentCall('/show-finder/playlists', postOptions);

    let playlistNamesById = await res.json();
    this.setState({ playlistNamesById: playlistNamesById });
    let names = [];
    Object.keys(playlistNamesById).forEach(x => names.push(playlistNamesById[x]));
    this.setState({
      showingPlaylists: true,
      showSpinner: false,
      headerText: 'Choose a playlist',
      playlists: names },
      () => ReactDOM.findDOMNode(this.playlistListRef.current).focus());
  };


  getArtists = async e => {
    e.preventDefault();

    let selectedPlaylistIndex = this.playlistListRef.current.state.lastSelected;
    if (selectedPlaylistIndex === null) {
      alert('You must select a playlist');
      return;
    }

    let playlistId = Object.keys(this.state.playlistNamesById)[selectedPlaylistIndex];
    let encodedPlaylistId = encodeURIComponent(playlistId);

    this.setState({
      showingPlaylists: false,
      showSpinner: true,
      headerText: `Fetching artists for '${this.state.playlistNamesById[playlistId]}'`
    });
    let res = await this.instrumentCall(`/show-finder/artists?playlistId=${encodedPlaylistId}`, { method: 'GET' });
    let artistJson = await res.json();
    let decodedArtists = [];
    for (let index in Object.keys(artistJson)) {
      decodedArtists.push(decodeURIComponent(artistJson[index]));
    }

    this.setState({
      showingArtists: true,
      showSpinner: false,
      allArtists: decodedArtists,
      headerText: this.state.playlistNamesById[playlistId]},
      () => ReactDOM.findDOMNode(this.artistListRef.current).focus());
  };

  getShowsForArtists = async e => {
    e.preventDefault();

    let selectedArtistIndices = this.artistListRef.current.state.selectedItems;

    // If no artists have been selected then selectedArtistIndices will be an iterator.
    // If any have, it will be an array. Fuck this list implementation
    if (selectedArtistIndices.length === undefined && selectedArtistIndices.next()) {
      alert('You must select at least one artist. Select the list and all artists are included by default.');
      return;
    }

    let encodedArtists = this.state.allArtists
      .filter((x, i) => selectedArtistIndices.includes(i))
      .map(x => encodeURIComponent(x));

    let postOptions = {
      method: 'POST',
      headers: {
        'Content-type': 'application/json'
      },
      body: JSON.stringify({ selectedArtists: encodedArtists, location: this.state.selectedLocation })
    }

    this.setState({
      showingArtists: false,
      showSpinner: true,
      headerText: 'Searching for shows...'});
    // list of { artistName, shows[] } objects
    let showsJson = await this.instrumentCall('/show-finder/shows', postOptions);
    let shows = await showsJson.json();

    // shows.length is actually a count of number of artists returned
    let showCount = shows.map(x => x.shows.length || 0).reduce((x, y) => x + y, 0);
    let location = this.state.locations.filter(x => x.value === this.state.selectedLocation).map(x => x.displayName);

    let header;
    if (shows.length > 0) {
      let selectedPlaylistIndex = this.playlistListRef.current.state.lastSelected;
      let playlistId = Object.keys(this.state.playlistNamesById)[selectedPlaylistIndex];
      header = `${showCount + (showCount === 1 ? ' show' : ' shows')} found in ${location} for ${shows.length + (shows.length === 1 ? ' artist' : ' artists')} on '${this.state.playlistNamesById[playlistId]}'`
    } else {
      header = `No ${location} shows found for those artists`;
    }

    this.setState({
      showingShows: true,
      showSpinner: false,
      headerText: header,
      shows: shows.map(x =>
        <div>
          <h3>{x.artistName}</h3>
          {x.shows.map(y => <li>{y}</li>)}
        </div>
      )
    });
  }

  userNameStateChange = (entry) => {
    console.log(entry.target.value); 
    this.setState({ userName: entry.target.value });
  }

  locationStateChange = (selection) => {
    console.log(selection.target.value);
    this.setState({ selectedLocation: selection.target.value });
  }

  render() {
    return (
      <div className="SpotifySearch">
        <button id="new-search-button" className="unselectable block" onClick={this.newSearch} style={{ display: this.state.showingForm ? 'none' : '' }}>New Search</button>
        <h1>{ this.state.headerText }</h1>
        <div className="loader" style={{ display: this.state.showSpinner ? '' : 'none' }}></div>
        <div style={{ display: this.state.showingForm ? '' : 'none' }}>
          <h4>Enter your spotify username:</h4>
          <form onSubmit={this.getPlaylists}>
            <div>
              <input className="textbox" type="text" onChange={this.userNameStateChange} />
              <select id='location-select' onChange={this.locationStateChange}>
                <option id='' disabled defaultValue> Choose a location </option>
                { this.state.locations.map(x => <option key={x.value} value={x.value}> {x.displayName} </option>) }
               </select>
           </div>
            <button className="unselectable" type="submit" disabled={this.state.selectedLocation == null || this.state.userName == null || this.state.userName === undefined || this.state.userName === ''}>Submit</button>
          </form>
        </div>
        <div>
        <form onSubmit={this.getArtists} style={{ display: this.state.showingPlaylists ? '' : 'none' }}>
          <div>
            <ReactList className="scroll-vertical" ref={ this.playlistListRef } items={this.state.playlists} />
          </div>
          <button className="unselectable" type="submit">Select playlist</button>
        </form>

        <form onSubmit={this.getShowsForArtists} style={{ display: this.state.showingArtists ? '' : 'none' }}>
          <div>
            <ReactList className="scroll-vertical" ref={ this.artistListRef } items={this.state.allArtists} multiple={true} selected={ Array(this.state.allArtists.length).keys() } />
          </div>
          <button className="unselectable" type="submit">Choose artists</button>
        </form>
        </div>

        { this.state.shows }
      </div>
    );
  }
}

export default SpotifySearch;