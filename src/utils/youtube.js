// This file contains utility functions for interacting with the YouTube API, such as searching for videos and retrieving video information.

import ytSearch from "yt-search";
import ytdl from "ytdl-core";

// Function to search for a video on YouTube
export const searchVideo = async (query) => {
  const result = await ytSearch(query);
  return result.videos.length > 0 ? result.videos[0] : null;
};

// Function to get video information by URL
export const getVideoInfo = async (url) => {
  if (!ytdl.validateURL(url)) throw new Error("Invalid URL");
  const info = await ytdl.getInfo(url);
  return {
    title: info.videoDetails.title,
    url: url,
    thumbnail: info.videoDetails.thumbnails[0].url,
    requester: info.videoDetails.author.name,
  };
};