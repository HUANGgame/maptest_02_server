package com.example.wififingerprintcollector

import java.util.PriorityQueue
import kotlin.math.sqrt

class NavigationEngine {
    data class RouteResult(
        val points: List<NavigationPoint>,
        val totalDistanceMeters: Float
    )

    fun planRoute(
        start: NavigationPoint,
        destination: NavigationPoint,
        allPoints: List<NavigationPoint>,
        maxEdgeMeters: Float
    ): RouteResult? {
        val nodes = allPoints
            .filter { it.mapId == start.mapId && it.floor == start.floor }
            .distinctBy { it.pointId }
            .sortedWith(compareBy<NavigationPoint> { it.timestamp }.thenBy { it.pointId })
        if (nodes.size < 2) return null
        if (nodes.none { it.pointId == start.pointId } || nodes.none { it.pointId == destination.pointId }) return null

        val edges = buildEdges(nodes, maxEdgeMeters)
        val routeIds = aStar(start.pointId, destination.pointId, nodes.associateBy { it.pointId }, edges)
            ?: return null
        val routePoints = routeIds.mapNotNull { pointId -> nodes.firstOrNull { it.pointId == pointId } }
        val distance = routePoints.zipWithNext().sumOf { (from, to) ->
            distanceMeters(from, to).toDouble()
        }.toFloat()
        return RouteResult(routePoints, distance)
    }

    fun nearestPoint(x: Float, y: Float, candidates: List<NavigationPoint>): NavigationPoint? {
        return candidates.minByOrNull { point ->
            val dx = point.x - x
            val dy = point.y - y
            dx * dx + dy * dy
        }
    }

    private fun buildEdges(
        nodes: List<NavigationPoint>,
        maxEdgeMeters: Float
    ): Map<String, List<Pair<String, Float>>> {
        val edges = mutableMapOf<String, MutableList<Pair<String, Float>>>()
        fun connect(a: NavigationPoint, b: NavigationPoint) {
            val distance = distanceMeters(a, b)
            edges.getOrPut(a.pointId) { mutableListOf() }.add(b.pointId to distance)
            edges.getOrPut(b.pointId) { mutableListOf() }.add(a.pointId to distance)
        }

        nodes.zipWithNext().forEach { (from, to) ->
            if (distanceMeters(from, to) <= maxEdgeMeters) connect(from, to)
        }

        return edges
    }

    private fun aStar(
        startId: String,
        goalId: String,
        nodes: Map<String, NavigationPoint>,
        edges: Map<String, List<Pair<String, Float>>>
    ): List<String>? {
        val openSet = PriorityQueue<Pair<String, Float>>(compareBy { it.second })
        val cameFrom = mutableMapOf<String, String>()
        val gScore = mutableMapOf(startId to 0f)
        openSet.add(startId to 0f)

        while (openSet.isNotEmpty()) {
            val currentId = openSet.poll()?.first ?: break
            if (currentId == goalId) return reconstructPath(cameFrom, currentId)

            val currentScore = gScore[currentId] ?: Float.MAX_VALUE
            edges[currentId].orEmpty().forEach { (neighborId, edgeCost) ->
                val tentativeScore = currentScore + edgeCost
                if (tentativeScore < (gScore[neighborId] ?: Float.MAX_VALUE)) {
                    cameFrom[neighborId] = currentId
                    gScore[neighborId] = tentativeScore
                    val heuristic = distanceMeters(nodes[neighborId], nodes[goalId])
                    openSet.add(neighborId to tentativeScore + heuristic)
                }
            }
        }
        return null
    }

    private fun reconstructPath(cameFrom: Map<String, String>, endId: String): List<String> {
        val route = mutableListOf(endId)
        var current = endId
        while (cameFrom.containsKey(current)) {
            current = cameFrom.getValue(current)
            route.add(current)
        }
        return route.asReversed()
    }

    private fun distanceMeters(a: NavigationPoint?, b: NavigationPoint?): Float {
        if (a == null || b == null) return Float.MAX_VALUE
        val dx = a.x - b.x
        val dy = a.y - b.y
        return sqrt(dx * dx + dy * dy)
    }
}
