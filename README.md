# activities-heatmap

## Description

This library generates a heatmap based on activity data, highlighting routes
and paths. The more frequently a path is used, the brighter it appears on the
map. The library can be used to implement a tile layer server that renders
heatmap tiles efficiently.

## Background

There are already tools and libraries to draw a heatmap of activities, for
example
[strava-local-heatmap-tool](https://github.com/roboes/strava-local-heatmap-tool).
But  the rendering is done on the client side, which can be inefficient for
large dataset. As of November 2024, I have about 1800 activities representing
1.5 million vertices. Downloading and parsing the data on the client side would
be prohibitive. That is why I developed that library for use on the server side
with a Node.js application.

## Installation
```bash
npm install activities-heatmap
```


## Usage

The following code renders the heatmap for the tile x, y, z:
```javascript
      import { HeatmapProducer } from 'activities-heatmap';

      const producer = new HeatmapProducer(datasource);
      const bitmap = await producer.BitmapForTile({x: x, y: y, z: z});
```
z is the zoom level, and x and y are tile coordinates, according to XYZ
standard implemented in OpenLayers, Leaflet, Mapbox, etc.

### Providing the data
The `dataSource` argument of `HeatmapForTile` represents an object that
provides access to activity data, and can retrieve paths within a given
bounding box. Two activities sources are provided:
- `StravaLocalZip`: reads activities from a local zip bulk export from strava.
- `PostgisDB`: reads activities from a postgis database.

You can implement your own data source by implementing the `ActivitiesSource`
interface.

### Filtering
data sources can optionally support filtering, to display the heatmap for a
subset of the activities only. By providing an `activitiesFilter` argument to
`HeatmapForTile`, it will pass than filter to the data source. Filter options
will be specific to each data source.

Both `StravaLocalZip` and `PostgisDB` support filtering by date, and by sport type.
If you implement your own datasource, you can decide which filters to
implement.

```javascript
      const bitmap = await producer.BitmapForTile({
                                          x: x, y: y, z: z,
                                          activitiesFilter: {startDate: '2020-01-01', endDate: '2020-12-31'}
                                         });
```


### Rendering options
You can customize the heatmap appeearance by passing a `renderingOptions` argument to `HeatmapForTile`.
The rendering options are:
- `valueForMaxColor`: Specifies the threshold for the brightest color. If a path has been taken more than this number of times, it is rendered with the brightest color. (Default is 25).
- `lineWidth`: Defines the width of the lines in the heatmap. (Default is 2).
- `gradientColors`: An array of colors to use as linear gradients when picking a color for the path.
  - Default is ```[ [0x4B, 0x00, 0x82, 130], [0xB2, 0x22, 0x22, 155], [0xFF, 0x00, 0x00, 180], [0xff, 0x45, 0x00, 205], [0xFF, 0x69, 0x00, 230], [0xFF, 0xFF, 0xE0, 255] ]```. 
  - For example, if the path has been taken more than valueForMaxColor, it will be rendered with the color [0xFF, 0xFF, 0xE0, 255] (aka rgba(255, 255, 224, 1)). If it has been taken between 80% and 100% of that value, it will be rendered with a color between [0xFF, 0x69, 0x00, 230] and [0xFF, 0xFF, 0xE0, 255] (aka rgba(255, 105, 0, 0.9) and rgba(255, 255, 224, 1)). And so on. 
  - By passing a different array of colors, you can change the rendering colors of the heatmap.

```javascript
      const bitmap = await producer.BitmapForTile({
                                          x: x, y: y, z: z,
                                          renderingOptions: {valueForMaxColor: 50, lineWidth: 3}
                                         });
```



## Implementation

### Pixel drawing
The heatmap is created by drawing activity paths on a bitmap. Each time a path
goes trough a pixel, the count is incremented for that pixel. After all paths
have been processed for, each pixel is colored according to the count.

I use anti-aliasing to avoid the heatmap paths from being blurry. It means that
I cannot use existing libraries like
[node-canvas](https://github.com/Automattic/node-canvas) or
[skia-canvas](https://github.com/samizdatco/skia-canvas) for line rendering,
and had to implement the line drawing algorithm inside the
```activities-heatmap```. With anti-aliasing and a configurable linewidth, it
requires to draw a polygon for each path. Fortunately, there are 
[good](https://gabormakesgames.com/blog_polygons_antialias.html)
[resources](https://bucior.com/antialising-polygon-edges-for-scanline-rendering/)
to implement that algorithm.

Indeed, each color channel contains only 256 values. So if I want to use 16
values for antialiasing, I would be able to draw only 16 (256/16) paths before
reaching the maximum value. With the default value, the maximum color is
applied for 25 paths. So in theory, I could have used 8 (256 / 32) levels of
antialiasing. But I want to provide the ability to specify a value of more than
32.

### Web workers
Rendering paths is computationally intensive, and is done on the main thread.
Unfortunately, moving the computation to a web worker would not improve the
situation, since the serialization/deserialization of the paths would take
longer than the computation itself.

## For reference:
strava blog about the implementation of the global heatmap:
https://medium.com/strava-engineering/the-global-heatmap-now-6x-hotter-23fc01d301de
