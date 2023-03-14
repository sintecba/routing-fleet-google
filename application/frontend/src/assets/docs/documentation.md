![application overview](Logo.jpg "Overview screenshot of Cloud Fleet Routing")

# Optimizacion de Rutas

## Contents

- [Overview](#overview)
  - [Quick tour](#quick-tour)
    - [Get an initial solution](#get-an-initial-solution)
    - [Make some adjustments](#make-some-adjustments)
    - [Using metadata](#using-metadata)
    - [Understanding the solver](#understanding-the-solver)
  - [Concepts](#concepts)
    - [Overall system and workflow](#overall-system-and-workflow)
    - [Terminology](#terminology)
- [Application components](#application-components)
- [How To Guides](#how-to-guides)
  - [Planning routes and visits](#planning-routes-and-visits)
  - [Saving a solution](#save-a-solution)
  - [Starting from an empty scenario](#starting-from-an-empty-scenario)
- [Frequently Asked Questions (FAQ)](#frequently-asked-questions)
- [Advanced topics](#advanced-topics)
  - [Load scenarios from another system](#load-scenarios-from-another-system)

## Overview

[back](#contents)

Cloud Fleet Routing is an end-user web application that planners on transportation or logistics team can use to plan pickups and deliveries to locations using a fleet of vehicles.

Behind the scenes, Cloud Fleet Routing uses a powerful service from Google called the Fleet Routing API. Cloud Fleet Routing makes it easy for a Planner to do their daily work without having to know the details of how the Fleet Routing API works.

Cloud Fleet Routing lets users:

- Plan fleeting routing [scenarios](#scenario) from a fresh start.
- Load pre-defined fleet routing scenarios from a local file or from a corporate [transportation management system](#tms).
- Generate a plan or [solution](#solution) to a scenario by calling the Fleet Routing API behind the scenes.
- Make manual adjustments to the scenario or the solution, such as moving a shipment from one vehicle to another, or changing the time window of a pick-up.
- Save the resulting plan (solution) to the TMS so that vehicles can be dispatched.

### Quick tour

[back](#contents)

Learn the basics of using Cloud Fleet Routing by getting a [solution](#solution) to a [vehicle routing problem](#vrp).

